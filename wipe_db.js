import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function wipeAll() {
  console.log('Starting complete data wipe...');

  // 1. Wipe MongoDB
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myhifimusic';
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    await mongoose.connection.db.dropDatabase();
    console.log('✅ MongoDB database successfully dropped and completely cleared.');
    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Failed to wipe MongoDB:', err.message);
  }

  // 2. Wipe Local Files
  const DIRS_TO_CLEAR = [
    path.join(__dirname, 'uploads', 'temp'),
    path.join(__dirname, 'uploads', 'songs'),
    path.join(__dirname, 'uploads', 'covers')
  ];

  DIRS_TO_CLEAR.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
      }
      console.log(`✅ Cleared all files from ${dir}`);
    }
  });

  // 3. Delete Legacy DB files
  const dbFiles = [
    path.join(__dirname, 'uploads', 'db.json'),
    path.join(__dirname, 'uploads', 'db.json.migrated')
  ];

  dbFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Deleted legacy database file: ${file}`);
    }
  });

  console.log('\n🎉 Wipe Complete! Your backend is now a completely clean slate.');
  process.exit(0);
}

wipeAll();
