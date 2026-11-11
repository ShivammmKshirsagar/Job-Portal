import mongoose from 'mongoose';
import fs from 'fs';

let mongoMemoryServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/careerconnect_db';

  try {
    // Attempt standard connection with 5-second timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return;
  } catch (err) {
    console.warn(`[MongoDB] Connection to ${uri} failed (${err.message}).`);
    if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
      throw err;
    }
    console.log('[MongoDB] Falling back to embedded in-memory MongoDB for local development...');
  }

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const opts = {
      instance: {
        dbName: 'careerconnect_db',
      },
    };

    const winBinary = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
    if (process.platform === 'win32' && fs.existsSync(winBinary)) {
      opts.binary = {
        systemBinary: winBinary,
        skipMD5Check: true,
      };
    }

    mongoMemoryServer = await MongoMemoryServer.create(opts);
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[MongoDB] Connected successfully to embedded instance: ${memoryUri}`);
  } catch (memErr) {
    console.error('[MongoDB] Failed to initialize in-memory MongoDB:', memErr.message);
    throw memErr;
  }
};

export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
  } catch (error) {
    console.error('[MongoDB] Error closing database connection:', error);
  }
};
