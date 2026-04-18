import mongoose from 'mongoose';

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/relife';
  
  try {
    await mongoose.connect(uri);
    console.log('[ReLife AI] Connected to MongoDB');
  } catch (error) {
    console.error('[ReLife AI] MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// We need to call this in server.js
export default connectDB;
