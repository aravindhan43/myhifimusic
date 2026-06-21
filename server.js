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
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Trust Render's proxy to fix rate-limiter ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
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

// --- Mongoose Schemas & Models ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'pending' },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  failedVerifyAttempts: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const songSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, default: 'Untitled Song' },
  artist: { type: String, default: 'Unknown Artist' },
  album: { type: String, default: 'Unknown Album' },
  genre: { type: String, default: 'Unknown Genre' },
  duration: { type: Number, default: 0 },
  audioUrl: String,
  coverUrl: String,
  audioPublicId: String,
  coverPublicId: String,
  isCloud: { type: Boolean, default: false },
  username: { type: String, required: true },
  lyrics: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model('Song', songSchema);

const playlistSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  songIds: [String],
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Playlist = mongoose.model('Playlist', playlistSchema);

const settingsSchema = new mongoose.Schema({
  cloudinaryCloudName: { type: String, default: '' },
  cloudinaryApiKey: { type: String, default: '' },
  cloudinaryApiSecret: { type: String, default: '' },
  jwtSecret: { type: String, default: '' },
  gmailUser: { type: String, default: '' },
  gmailAppPassword: { type: String, default: '' }
});
const Settings = mongoose.model('Settings', settingsSchema);

// --- Database Connection ---
let dbReady = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myhifimusic';

// Log masked URI for debugging (hide password)
const maskedUri = MONGO_URI.replace(/:([^@]+)@/, ':****@');
console.log(`MongoDB URI: ${maskedUri}`);

async function connectWithRetry(retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log('MongoDB connected successfully');
      dbReady = true;
      await migrateLegacyDB();
      await configureCloudinary();
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (err.reason) console.error('Reason:', JSON.stringify(err.reason));
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error('FATAL: Could not connect to MongoDB after all retries. API will be unavailable.');
  console.error('Please verify: 1) MONGO_URI env var is correct, 2) MongoDB Atlas Network Access allows 0.0.0.0/0, 3) Atlas cluster is not paused');
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
  dbReady = false;
});
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
  dbReady = true;
});

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: dbReady ? 'ok' : 'degraded',
    db: dbReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Middleware: block API routes if DB is not ready
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next(); // skip health check
  if (!dbReady) {
    return res.status(503).json({ 
      error: 'Server is starting up. Please wait a moment and try again.',
      retryAfter: 5
    });
  }
  next();
});

// --- Legacy Migration ---
async function migrateLegacyDB() {
  const DB_PATH = path.join(__dirname, 'uploads', 'db.json');
  if (fs.existsSync(DB_PATH)) {
    try {
      console.log('Found legacy db.json. Migrating to MongoDB...');
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      
      let currentSettings = await Settings.findOne();
      if (!currentSettings) {
         currentSettings = new Settings(data.settings || {});
         if (!currentSettings.jwtSecret) currentSettings.jwtSecret = crypto.randomBytes(32).toString('hex');
         await currentSettings.save();
      }

      if (data.users && data.users.length > 0) {
         for (const u of data.users) {
            const exists = await User.findOne({ username: u.username });
            if (!exists) {
               await User.create({
                 username: u.username,
                 email: u.email || `${u.username}@example.com`, // Email was added later, fill if missing
                 password: u.password,
                 role: u.role || 'user',
                 status: u.status || 'approved',
                 isVerified: u.isVerified !== false,
                 verificationCode: u.verificationCode || null
               });
            }
         }
      }
      if (data.songs && data.songs.length > 0) {
         for (const s of data.songs) {
            const exists = await Song.findOne({ id: s.id });
            if (!exists) await Song.create(s);
         }
      }
      if (data.playlists && data.playlists.length > 0) {
         for (const p of data.playlists) {
            const exists = await Playlist.findOne({ id: p.id });
            if (!exists) await Playlist.create(p);
         }
      }
      // Rename to avoid running again
      fs.renameSync(DB_PATH, DB_PATH + '.migrated');
      console.log('Legacy DB migration complete.');
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
}

// --- Helper Functions ---
async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    settings = await Settings.create({ jwtSecret });
  } else if (!settings.jwtSecret) {
    settings.jwtSecret = crypto.randomBytes(32).toString('hex');
    await settings.save();
  }
  return settings;
}

async function configureCloudinary() {
  const settings = await getSettings();
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = settings;
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

// --- SECURE AUTHORIZATION MIDDLEWARE ---
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }
  
  const settings = await getSettings();
  const jwtSecret = settings.jwtSecret || 'default_fallback_secret_1289471';

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
    req.user = user;
    next();
  });
}

async function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, async () => {
    if (!req.user) return; // handled by authenticateToken
    const user = await User.findOne({ username: req.user.username });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

// --- API ROUTES ---

// 0. Authentication Routes
app.get('/api/auth/status', async (req, res) => {
  const count = await User.countDocuments();
  res.json({ registered: count > 0 });
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

  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).json({ error: 'Username already exists' });
  
  const existingEmail = await User.findOne({ email });
  if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const count = await User.countDocuments();
    const isFirstUser = count === 0;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`\n================================`);
    console.log(`[DEV ONLY] Email Authentication Code for ${email}: ${verificationCode}`);
    console.log(`================================\n`);
    
    await User.create({ 
      username, 
      email,
      password: hashedPassword,
      role: isFirstUser ? 'admin' : 'user',
      status: isFirstUser ? 'approved' : 'pending',
      isVerified: isFirstUser ? true : false,
      verificationCode: isFirstUser ? null : verificationCode
    });
    
    // If it's the admin, skip email verification entirely
    if (isFirstUser) {
      return res.json({ success: true, message: 'Admin account created successfully.', requiresVerification: false });
    }
    
    // Try to send real email
    const settings = await getSettings();
    const { gmailUser, gmailAppPassword } = settings;

    if (gmailUser && gmailAppPassword) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailAppPassword }
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
      }
    } else {
      console.log(`✉️ MOCK EMAIL SENT to ${email}`);
    }
    
    res.json({ success: true, message: 'Verification code sent to email', requiresVerification: true });
  } catch (err) {
    res.status(500).json({ error: 'Registration failure: ' + err.message });
  }
});

app.post('/api/auth/verify', verifyLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'User not found' });
  if (user.isVerified) return res.status(400).json({ error: 'Account is already verified' });

  if (user.verificationCode !== code) {
    user.failedVerifyAttempts += 1;
    if (user.failedVerifyAttempts >= 5) {
      user.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.failedVerifyAttempts = 0;
      await user.save();
      return res.status(400).json({ error: 'Too many failed attempts. A new code has been sent/generated.' });
    }
    await user.save();
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  user.isVerified = true;
  user.verificationCode = null;
  user.failedVerifyAttempts = 0;
  await user.save();

  res.json({ success: true, message: 'Account verified successfully. You can now sign in.' });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  const user = await User.findOne({ $or: [{ username }, { email: username }] });
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
      
      const settings = await getSettings();
      const jwtSecret = settings.jwtSecret || 'default_fallback_secret_1289471';
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
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  const users = await User.find({}, 'username email role status');
  res.json(users);
});

app.post('/api/admin/users/:username/approve', authenticateAdmin, async (req, res) => {
  const user = await User.findOneAndUpdate({ username: req.params.username }, { status: 'approved' }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: { username: user.username, role: user.role, status: user.status } });
});

app.post('/api/admin/users/:username/reject', authenticateAdmin, async (req, res) => {
  const user = await User.findOneAndUpdate({ username: req.params.username }, { status: 'rejected' }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, message: 'User rejected' });
});

app.put('/api/admin/users/:username', authenticateAdmin, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const { email, role, status, password } = req.body;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  if (password) {
    user.password = await bcrypt.hash(password, 10);
  }
  
  await user.save();
  res.json({ success: true, user: { username: user.username, email: user.email, role: user.role, status: user.status } });
});

app.delete('/api/admin/users/:username', authenticateAdmin, async (req, res) => {
  const username = req.params.username;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const userSongs = await Song.find({ username });
  for (const song of userSongs) {
    try {
      if (song.isCloud) {
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
  await Song.deleteMany({ username });
  await Playlist.deleteMany({ username });
  await User.deleteOne({ username });
  
  res.json({ success: true, message: 'User and their data deleted successfully' });
});

// 1. Settings Routes
app.get('/api/settings', authenticateAdmin, async (req, res) => {
  const settings = await getSettings();
  const cleanSettings = settings.toObject();
  delete cleanSettings.jwtSecret;
  delete cleanSettings.gmailAppPassword;
  delete cleanSettings.cloudinaryApiSecret;
  res.json(cleanSettings || {});
});

app.post('/api/settings', authenticateAdmin, async (req, res) => {
  const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, gmailUser, gmailAppPassword } = req.body;
  const settings = await getSettings();
  
  if (cloudinaryCloudName !== undefined) settings.cloudinaryCloudName = cloudinaryCloudName;
  if (cloudinaryApiKey !== undefined) settings.cloudinaryApiKey = cloudinaryApiKey;
  if (cloudinaryApiSecret !== undefined) settings.cloudinaryApiSecret = cloudinaryApiSecret;
  if (gmailUser !== undefined) settings.gmailUser = gmailUser;
  if (gmailAppPassword !== undefined) settings.gmailAppPassword = gmailAppPassword;
  
  await settings.save();
  const configured = await configureCloudinary();
  
  const cleanSettings = settings.toObject();
  delete cleanSettings.jwtSecret;
  delete cleanSettings.gmailAppPassword;
  delete cleanSettings.cloudinaryApiSecret;
  
  res.json({ success: true, settings: cleanSettings, configured });
});

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

  const settings = await getSettings();
  const isCloudConfigured = !!(settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret);

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

    if (!coverUrl) coverUrl = '/placeholder-album.png';

    const newSong = await Song.create({
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
      username: req.user.username
    });

    res.json(newSong);
  } catch (err) {
    console.error('Confirmation failed:', err);
    res.status(500).json({ error: 'Failed to process and sync song: ' + err.message });
  }
});

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

app.get('/api/songs', authenticateToken, async (req, res) => {
  const songs = await Song.find({ username: req.user.username });
  res.json(songs);
});

app.delete('/api/songs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const song = await Song.findOne({ id, username: req.user.username });

  if (!song) {
    return res.status(404).json({ error: 'Song not found or unauthorized' });
  }

  try {
    const settings = await getSettings();
    const isCloudConfigured = !!(settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret);

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

    await Playlist.updateMany(
      { username: req.user.username },
      { $pull: { songIds: id } }
    );

    await Song.deleteOne({ id });
    res.json({ success: true, message: 'Song deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ error: 'Failed to delete song: ' + err.message });
  }
});

// 7. Playlist Routes
app.get('/api/playlists', authenticateToken, async (req, res) => {
  const playlists = await Playlist.find({ username: req.user.username });
  res.json(playlists);
});

app.post('/api/playlists', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  const newPlaylist = await Playlist.create({
    id: `playlist_${Date.now()}`,
    name,
    description: description || '',
    songIds: [],
    username: req.user.username
  });

  res.json(newPlaylist);
});

app.put('/api/playlists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  const playlist = await Playlist.findOne({ id, username: req.user.username });
  if (!playlist) return res.status(404).json({ error: 'Playlist not found or unauthorized' });

  playlist.name = name;
  if (description !== undefined) playlist.description = description;

  await playlist.save();
  res.json(playlist);
});

app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const result = await Playlist.deleteOne({ id, username: req.user.username });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  res.json({ success: true, message: 'Playlist deleted' });
});

app.post('/api/playlists/:id/add', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { songId } = req.body;

  if (!songId) return res.status(400).json({ error: 'Song ID is required' });

  const playlist = await Playlist.findOne({ id, username: req.user.username });
  if (!playlist) return res.status(404).json({ error: 'Playlist not found or unauthorized' });

  const song = await Song.findOne({ id: songId, username: req.user.username });
  if (!song) return res.status(404).json({ error: 'Song not found in library or unauthorized' });

  if (!playlist.songIds.includes(songId)) {
    playlist.songIds.push(songId);
    await playlist.save();
  }

  res.json(playlist);
});

app.post('/api/playlists/:id/remove', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { songId } = req.body;

  const playlist = await Playlist.findOne({ id, username: req.user.username });
  if (!playlist) return res.status(404).json({ error: 'Playlist not found or unauthorized' });

  playlist.songIds = playlist.songIds.filter(sid => sid !== songId);
  await playlist.save();
  res.json(playlist);
});

// 8. Add Song Lyrics
app.post('/api/songs/:id/lyrics', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { lyrics } = req.body;

  const song = await Song.findOne({ id, username: req.user.username });
  if (!song) return res.status(404).json({ error: 'Song not found or unauthorized' });

  song.lyrics = lyrics || '';
  await song.save();
  res.json(song);
});

// Serve frontend in production
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server and connect to DB
app.listen(PORT, async () => {
  console.log(`Secure Cloud audio server running on port ${PORT}`);
  await connectWithRetry();
});
