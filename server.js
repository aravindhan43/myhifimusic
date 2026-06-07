import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as musicMetadata from 'music-metadata';
import { v2 as cloudinary } from 'cloudinary';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'uploads', 'temp'),
  createParentPath: true
}));

// Ensure necessary directories exist
const DIRS = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads', 'temp'),
  path.join(__dirname, 'uploads', 'songs'),
  path.join(__dirname, 'uploads', 'covers')
];
DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DB_PATH = path.join(__dirname, 'db.json');

// Helper to read database and auto-generate secret keys
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const jwtSecret = crypto.randomBytes(32).toString('hex');
      const initial = { 
        songs: [], 
        playlists: [], 
        users: [],
        settings: { 
          cloudinaryCloudName: '', 
          cloudinaryApiKey: '', 
          cloudinaryApiSecret: '', 
          jwtSecret 
        } 
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    
    // Auto-generate key if missing (backward compatibility)
    if (parsed.settings && !parsed.settings.jwtSecret) {
      parsed.settings.jwtSecret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (err) {
    console.error('Error reading DB:', err);
    return { 
      songs: [], 
      playlists: [], 
      settings: { 
        cloudinaryCloudName: '', 
        cloudinaryApiKey: '', 
        cloudinaryApiSecret: '', 
        jwtSecret: 'default_fallback_secret_1289471' 
      } 
    };
  }
}

// Helper to write database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Configure Cloudinary from DB settings
function configureCloudinary() {
  const db = readDB();
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = db.settings || {};
  if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
    cloudinary.config({
      cloud_name: cloudinaryCloudName,
      api_key: cloudinaryApiKey,
      api_secret: cloudinaryApiSecret,
      secure: true
    });
    console.log('Cloudinary successfully configured.');
    return true;
  }
  console.log('Cloudinary not configured. Running in local fallback mode.');
  return false;
}

// Initialize Cloudinary configuration on boot
configureCloudinary();

// --- SECURE AUTHORIZATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }
  
  const db = readDB();
  const jwtSecret = (db.settings && db.settings.jwtSecret) || 'default_fallback_secret_1289471';

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
    req.user = user;
    next();
  });
}

function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    const db = readDB();
    const users = getUsers(db);
    const dbUser = users.find(u => u.username === req.user.username);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

// --- API ROUTES ---

// Helper to ensure users array exists and migrate legacy owner
function getUsers(db) {
  db.users = db.users || [];
  if (db.settings && db.settings.owner && db.settings.owner.username) {
    if (!db.users.find(u => u.username === db.settings.owner.username)) {
      db.users.push({
        username: db.settings.owner.username,
        password: db.settings.owner.password,
        role: 'admin',
        status: 'approved'
      });
    }
  }
  // Ensure existing migrated users have roles
  db.users.forEach(u => {
    if (db.settings && db.settings.owner && u.username === db.settings.owner.username) {
      u.role = 'admin';
    } else if (!u.role) {
      u.role = 'user';
    }
    if (!u.status) u.status = 'approved'; // Default to approved for pre-existing accounts
    if (u.isVerified === undefined) u.isVerified = true; // Legacy users are auto-verified
  });

  // Data Migration for Separate User Accounts
  let migrated = false;
  const adminUsername = db.users.length > 0 ? (db.users.find(u => u.role === 'admin')?.username || db.users[0].username) : 'admin';
  if (db.songs) {
    db.songs.forEach(s => {
      if (!s.username) {
        s.username = adminUsername;
        migrated = true;
      }
    });
  }
  if (db.playlists) {
    db.playlists.forEach(p => {
      if (!p.username) {
        p.username = adminUsername;
        migrated = true;
      }
    });
  }
  if (migrated) writeDB(db);

  return db.users;
}

// 0. Authentication Routes
app.get('/api/auth/status', (req, res) => {
  const db = readDB();
  const users = getUsers(db);
  res.json({ registered: users.length > 0 });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts, please try again later.' }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (!email.toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Registration is restricted to @gmail.com addresses only.' });
  }

  const db = readDB();
  const users = getUsers(db);
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const isFirstUser = users.length === 0;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    users.push({ 
      username, 
      email,
      password: hashedPassword,
      role: isFirstUser ? 'admin' : 'user',
      status: isFirstUser ? 'approved' : 'pending',
      isVerified: false,
      verificationCode
    });
    db.users = users;
    writeDB(db);
    
    // Try to send real email if credentials exist, otherwise mock
    const gmailUser = db.settings && db.settings.gmailUser;
    const gmailAppPassword = db.settings && db.settings.gmailAppPassword;

    if (gmailUser && gmailAppPassword) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailAppPassword
          }
        });
        
        await transporter.sendMail({
          from: `"MyHIF Accounts" <${gmailUser}>`,
          to: email,
          subject: 'Verify your MyHIF Account',
          text: `Welcome to MyHIF!\n\nYour verification code is: ${verificationCode}\n\nPlease enter this code in the app to complete your registration.`
        });
        console.log(`✉️ Real email sent to ${email} via Nodemailer`);
      } catch (emailErr) {
        console.error('Failed to send real email, falling back to mock:', emailErr.message);
        console.log(`\n=========================================`);
        console.log(`✉️ MOCK EMAIL SENT (Fallback)`);
        console.log(`To: ${email}`);
        console.log(`Verification Code: ${verificationCode}`);
        console.log(`=========================================\n`);
      }
    } else {
      // Mock sending email by logging to console
      console.log(`\n=========================================`);
      console.log(`✉️ MOCK EMAIL SENT`);
      console.log(`To: ${email}`);
      console.log(`Verification Code: ${verificationCode}`);
      console.log(`=========================================\n`);
    }
    
    res.json({ success: true, message: 'Verification code sent to email', requiresVerification: true });
  } catch (err) {
    res.status(500).json({ error: 'Registration failure: ' + err.message });
  }
});

app.post('/api/auth/verify', verifyLimiter, (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const db = readDB();
  const users = getUsers(db);
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }
  if (user.isVerified) {
    return res.status(400).json({ error: 'Account is already verified' });
  }
  if (user.verificationCode !== code) {
    user.failedVerifyAttempts = (user.failedVerifyAttempts || 0) + 1;
    if (user.failedVerifyAttempts >= 5) {
      user.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.failedVerifyAttempts = 0;
      db.users = users;
      writeDB(db);
      return res.status(400).json({ error: 'Too many failed attempts. A new code has been sent/generated.' });
    }
    db.users = users;
    writeDB(db);
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  user.isVerified = true;
  user.verificationCode = null; // Clear the code once verified
  user.failedVerifyAttempts = 0;
  db.users = users;
  writeDB(db);

  res.json({ success: true, message: 'Account verified successfully. You can now sign in.' });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const users = getUsers(db);
  
  const user = users.find(u => u.username === username || (u.email && u.email === username));
  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  try {
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
      if (user.isVerified === false) {
        return res.status(403).json({ error: 'Please verify your email address before logging in.' });
      }
      if (user.status === 'pending') {
        return res.status(403).json({ error: 'Your account is pending admin approval.' });
      }
      if (user.status === 'rejected') {
        return res.status(403).json({ error: 'Your account registration was rejected.' });
      }
      
      const jwtSecret = (db.settings && db.settings.jwtSecret) || 'default_fallback_secret_1289471';
      const token = jwt.sign({ username: user.username, role: user.role }, jwtSecret, { expiresIn: '7d' });
      res.json({ success: true, token, role: user.role, username: user.username });
    } else {
      res.status(401).json({ error: 'Invalid username/email or password' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Authentication failure: ' + err.message });
  }
});

// 0.5 Admin Routes
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  const db = readDB();
  const users = getUsers(db).map(u => ({ 
    username: u.username, 
    email: u.email || 'N/A',
    role: u.role, 
    status: u.status 
  }));
  res.json(users);
});

app.post('/api/admin/users/:username/approve', authenticateAdmin, (req, res) => {
  const db = readDB();
  const users = getUsers(db);
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  user.status = 'approved';
  writeDB(db);
  res.json({ success: true, user: { username: user.username, role: user.role, status: user.status } });
});

app.post('/api/admin/users/:username/reject', authenticateAdmin, (req, res) => {
  const db = readDB();
  let users = getUsers(db);
  const userIndex = users.findIndex(u => u.username === req.params.username);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  
  users[userIndex].status = 'rejected';
  writeDB(db);
  res.json({ success: true, message: 'User rejected' });
});

app.put('/api/admin/users/:username', authenticateAdmin, (req, res) => {
  const db = readDB();
  const users = getUsers(db);
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const { email, role, status } = req.body;
  
  // Basic protection to prevent demoting the owner
  if (db.settings && db.settings.owner && user.username === db.settings.owner.username) {
    if (role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change the role of the primary owner' });
    }
  }

  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  
  writeDB(db);
  res.json({ success: true, user: { username: user.username, email: user.email, role: user.role, status: user.status } });
});

app.delete('/api/admin/users/:username', authenticateAdmin, async (req, res) => {
  const db = readDB();
  const users = getUsers(db);
  const username = req.params.username;
  const userIndex = users.findIndex(u => u.username === username);
  
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  
  if (db.settings && db.settings.owner && username === db.settings.owner.username) {
    return res.status(400).json({ error: 'Cannot delete the primary owner' });
  }
  
  // Cleanup user's songs and playlists
  const isCloudConfigured = configureCloudinary();
  if (db.songs) {
    const userSongs = db.songs.filter(s => s.username === username);
    for (const song of userSongs) {
      try {
        if (song.isCloud && isCloudConfigured) {
          if (song.audioPublicId) await cloudinary.uploader.destroy(song.audioPublicId, { resource_type: 'video' });
          if (song.coverPublicId) await cloudinary.uploader.destroy(song.coverPublicId);
        } else {
          if (song.audioUrl && song.audioUrl.startsWith('/uploads/songs/')) {
            const audioPath = path.join(__dirname, song.audioUrl);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          }
          if (song.coverUrl && song.coverUrl.startsWith('/uploads/covers/')) {
            const coverPath = path.join(__dirname, song.coverUrl);
            if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
          }
        }
      } catch (e) {
        console.error('Error cleaning up song:', song.id, e);
      }
    }
    db.songs = db.songs.filter(s => s.username !== username);
  }
  
  if (db.playlists) {
    db.playlists = db.playlists.filter(p => p.username !== username);
  }
  
  db.users.splice(userIndex, 1);
  writeDB(db);
  res.json({ success: true, message: 'User and their data deleted successfully' });
});

// 1. Settings Routes
app.get('/api/settings', authenticateAdmin, (req, res) => {
  const db = readDB();
  // Strip out owner credentials and secrets before returning settings
  const cleanSettings = { ...db.settings };
  if (cleanSettings.owner) delete cleanSettings.owner;
  if (cleanSettings.jwtSecret) delete cleanSettings.jwtSecret;
  if (cleanSettings.gmailAppPassword) delete cleanSettings.gmailAppPassword;
  if (cleanSettings.cloudinaryApiSecret) delete cleanSettings.cloudinaryApiSecret;
  res.json(cleanSettings || {});
});

app.post('/api/settings', authenticateAdmin, (req, res) => {
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, gmailUser, gmailAppPassword } = req.body;
  const db = readDB();
  
  db.settings.cloudinaryCloudName = cloudinaryCloudName || '';
  db.settings.cloudinaryApiKey = cloudinaryApiKey || '';
  db.settings.cloudinaryApiSecret = cloudinaryApiSecret || '';
  if (gmailUser !== undefined) db.settings.gmailUser = gmailUser;
  if (gmailAppPassword !== undefined) db.settings.gmailAppPassword = gmailAppPassword;
  
  writeDB(db);
  const configured = configureCloudinary();
  res.json({ success: true, settings: db.settings, configured });
});

// Test Cloudinary connection
app.post('/api/settings/test', authenticateToken, async (req, res) => {
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = req.body;
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    return res.status(400).json({ error: 'All Cloudinary credentials are required' });
  }

  try {
    const tempConfig = {
      cloud_name: cloudinaryCloudName,
      api_key: cloudinaryApiKey,
      api_secret: cloudinaryApiSecret,
      secure: true
    };
    
    const oldConfig = cloudinary.config();
    cloudinary.config(tempConfig);
    
    await cloudinary.api.resources({ max_results: 1 });
    
    cloudinary.config(oldConfig);
    res.json({ success: true, message: 'Cloudinary connection successful!' });
  } catch (err) {
    console.error('Cloudinary test failed:', err);
    res.status(500).json({ error: err.message || 'Connection test failed. Please verify your credentials.' });
  }
});

// 2. Upload Preview Route
app.post('/api/upload-preview', authenticateToken, async (req, res) => {
  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const audioFile = req.files.audio;
  const tempAudioPath = audioFile.tempFilePath;
  const ext = path.extname(audioFile.name) || '.mp3';

  const properTempPath = tempAudioPath + ext;
  fs.renameSync(tempAudioPath, properTempPath);

  try {
    const metadata = await musicMetadata.parseFile(properTempPath);
    const { common, format } = metadata;

    const previewData = {
      title: common.title || path.basename(audioFile.name, ext),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      genre: common.genre ? common.genre[0] : 'Unknown Genre',
      duration: format.duration || 0,
      tempAudioPath: properTempPath,
      hasCover: false,
      tempCoverPath: ''
    };

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const coverExt = picture.format === 'image/png' ? '.png' : '.jpg';
      const tempCoverName = `cover_${Date.now()}_${Math.floor(Math.random() * 1000)}${coverExt}`;
      const tempCoverPath = path.join(__dirname, 'uploads', 'temp', tempCoverName);
      
      fs.writeFileSync(tempCoverPath, picture.data);
      previewData.hasCover = true;
      previewData.tempCoverPath = tempCoverPath;
      previewData.coverUrl = `/uploads/temp/${tempCoverName}`;
    }

    res.json(previewData);
  } catch (err) {
    console.error('Metadata parsing failed:', err);
    if (fs.existsSync(properTempPath)) fs.unlinkSync(properTempPath);
    res.status(500).json({ error: 'Failed to parse audio metadata: ' + err.message });
  }
});

// 3. Confirm Song Upload Route
app.post('/api/songs/confirm', authenticateToken, async (req, res) => {
  const {
    title,
    artist,
    album,
    genre,
    duration,
    tempAudioPath,
    tempCoverPath,
    customCoverUrl
  } = req.body;

  if (!tempAudioPath || typeof tempAudioPath !== 'string') {
    return res.status(400).json({ error: 'Original audio file path is missing' });
  }

  const tempDir = path.resolve(__dirname, 'uploads', 'temp');
  const resolvedAudioPath = path.resolve(tempAudioPath);
  
  if (!resolvedAudioPath.startsWith(tempDir)) {
    return res.status(403).json({ error: 'Invalid tempAudioPath: Path traversal detected.' });
  }
  if (!fs.existsSync(resolvedAudioPath)) {
    return res.status(400).json({ error: 'Original audio file not found in temp' });
  }

  let resolvedCoverPath = null;
  if (tempCoverPath && typeof tempCoverPath === 'string') {
    resolvedCoverPath = path.resolve(tempCoverPath);
    if (!resolvedCoverPath.startsWith(tempDir)) {
      return res.status(403).json({ error: 'Invalid tempCoverPath: Path traversal detected.' });
    }
  }

  const db = readDB();
  const isCloudConfigured = configureCloudinary();

  let audioUrl = '';
  let coverUrl = '';
  let audioPublicId = '';
  let coverPublicId = '';

  try {
    if (isCloudConfigured) {
      console.log('Uploading audio to Cloudinary...');
      const audioResult = await cloudinary.uploader.upload(tempAudioPath, {
        resource_type: 'video',
        folder: 'apple_music_clone/songs'
      });
      audioUrl = audioResult.secure_url;
      audioPublicId = audioResult.public_id;

      if (tempCoverPath && fs.existsSync(tempCoverPath)) {
        console.log('Uploading cover art to Cloudinary...');
        const coverResult = await cloudinary.uploader.upload(tempCoverPath, {
          folder: 'apple_music_clone/covers'
        });
        coverUrl = coverResult.secure_url;
        coverPublicId = coverResult.public_id;
      } else if (customCoverUrl) {
        coverUrl = customCoverUrl;
      }
    } else {
      const songId = `song_${Date.now()}`;
      const songName = `${songId}${path.extname(tempAudioPath)}`;
      const permAudioPath = path.join(__dirname, 'uploads', 'songs', songName);
      fs.copyFileSync(tempAudioPath, permAudioPath);
      audioUrl = `/uploads/songs/${songName}`;

      if (tempCoverPath && fs.existsSync(tempCoverPath)) {
        const coverName = `${songId}${path.extname(tempCoverPath)}`;
        const permCoverPath = path.join(__dirname, 'uploads', 'covers', coverName);
        fs.copyFileSync(tempCoverPath, permCoverPath);
        coverUrl = `/uploads/covers/${coverName}`;
      } else if (customCoverUrl) {
        coverUrl = customCoverUrl;
      }
    }

    try {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (tempCoverPath && fs.existsSync(tempCoverPath)) fs.unlinkSync(tempCoverPath);
    } catch (cleanupErr) {
      console.warn('Temp cleanup error:', cleanupErr);
    }

    if (!coverUrl) {
      coverUrl = '/placeholder-album.png';
    }

    const newSong = {
      id: `song_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: title || 'Untitled Song',
      artist: artist || 'Unknown Artist',
      album: album || 'Unknown Album',
      genre: genre || 'Unknown Genre',
      duration: parseFloat(duration) || 0,
      audioUrl,
      coverUrl,
      audioPublicId,
      coverPublicId,
      isCloud: isCloudConfigured,
      username: req.user.username,
      createdAt: new Date().toISOString()
    };

    db.songs.push(newSong);
    writeDB(db);

    res.json(newSong);
  } catch (err) {
    console.error('Confirmation failed:', err);
    res.status(500).json({ error: 'Failed to process and sync song: ' + err.message });
  }
});

// 4. Custom Album Art Upload for Confirm
app.post('/api/upload-cover', authenticateToken, (req, res) => {
  if (!req.files || !req.files.cover) {
    return res.status(400).json({ error: 'No cover file uploaded' });
  }

  const coverFile = req.files.cover;
  const tempPath = coverFile.tempFilePath;
  const ext = path.extname(coverFile.name) || '.jpg';
  
  const coverName = `custom_${Date.now()}${ext}`;
  const properTempPath = path.join(__dirname, 'uploads', 'temp', coverName);
  
  fs.renameSync(tempPath, properTempPath);

  res.json({
    tempCoverPath: properTempPath,
    coverUrl: `/uploads/temp/${coverName}`
  });
});

// 5. Get All Songs
app.get('/api/songs', authenticateToken, (req, res) => {
  const db = readDB();
  const userSongs = (db.songs || []).filter(s => s.username === req.user.username);
  res.json(userSongs);
});

// 6. Delete Song
app.delete('/api/songs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const songIndex = db.songs.findIndex(s => s.id === id && s.username === req.user.username);

  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found or unauthorized' });
  }

  const song = db.songs[songIndex];

  try {
    if (song.isCloud && configureCloudinary()) {
      if (song.audioPublicId) {
        await cloudinary.uploader.destroy(song.audioPublicId, { resource_type: 'video' });
      }
      if (song.coverPublicId) {
        await cloudinary.uploader.destroy(song.coverPublicId);
      }
    } else {
      if (song.audioUrl && song.audioUrl.startsWith('/uploads/songs/')) {
        const audioPath = path.join(__dirname, song.audioUrl);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      }
      if (song.coverUrl && song.coverUrl.startsWith('/uploads/covers/')) {
        const coverPath = path.join(__dirname, song.coverUrl);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      }
    }

    if (db.playlists) {
      db.playlists.forEach(pl => {
        if (pl.songIds) {
          pl.songIds = pl.songIds.filter(sid => sid !== id);
        }
      });
    }

    db.songs.splice(songIndex, 1);
    writeDB(db);

    res.json({ success: true, message: 'Song deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ error: 'Failed to delete song: ' + err.message });
  }
});

// 7. Playlist Routes
app.get('/api/playlists', authenticateToken, (req, res) => {
  const db = readDB();
  const userPlaylists = (db.playlists || []).filter(p => p.username === req.user.username);
  res.json(userPlaylists);
});

app.post('/api/playlists', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const db = readDB();
  const newPlaylist = {
    id: `playlist_${Date.now()}`,
    name,
    description: description || '',
    songIds: [],
    username: req.user.username,
    createdAt: new Date().toISOString()
  };

  db.playlists = db.playlists || [];
  db.playlists.push(newPlaylist);
  writeDB(db);

  res.json(newPlaylist);
});

app.put('/api/playlists/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const db = readDB();
  const playlist = db.playlists.find(p => p.id === id && p.username === req.user.username);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  }

  playlist.name = name;
  if (description !== undefined) {
    playlist.description = description;
  }

  writeDB(db);
  res.json(playlist);
});

app.delete('/api/playlists/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  const db = readDB();
  const playlistIndex = db.playlists.findIndex(p => p.id === id && p.username === req.user.username);

  if (playlistIndex === -1) {
    return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  }

  db.playlists.splice(playlistIndex, 1);
  writeDB(db);

  res.json({ success: true, message: 'Playlist deleted' });
});

app.post('/api/playlists/:id/add', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { songId } = req.body;

  if (!songId) {
    return res.status(400).json({ error: 'Song ID is required' });
  }

  const db = readDB();
  const playlist = db.playlists.find(p => p.id === id && p.username === req.user.username);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  }

  if (!db.songs.some(s => s.id === songId && s.username === req.user.username)) {
    return res.status(404).json({ error: 'Song not found in library or unauthorized' });
  }

  if (!playlist.songIds.includes(songId)) {
    playlist.songIds.push(songId);
  }

  writeDB(db);
  res.json(playlist);
});

app.post('/api/playlists/:id/remove', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { songId } = req.body;

  const db = readDB();
  const playlist = db.playlists.find(p => p.id === id && p.username === req.user.username);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  }

  playlist.songIds = playlist.songIds.filter(sid => sid !== songId);
  writeDB(db);

  res.json(playlist);
});

// 8. Add Song Lyrics
app.post('/api/songs/:id/lyrics', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { lyrics } = req.body;

  const db = readDB();
  const song = db.songs.find(s => s.id === id && s.username === req.user.username);

  if (!song) {
    return res.status(404).json({ error: 'Song not found or unauthorized' });
  }

  song.lyrics = lyrics || '';
  writeDB(db);
  res.json(song);
});

app.listen(PORT, () => {
  console.log(`Secure Cloud audio server running on port ${PORT}`);
});
