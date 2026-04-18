/**
 * User store — uses MongoDB via Mongoose
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';

export async function createUser({ name, email, password }) {
  const existing = await findUserByEmail(email);
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date(),
    analysisCount: 0,
    itemsSaved: 0,
    co2Saved: 0
  });

  const { passwordHash: _, _id, __v, ...safeUser } = user.toObject();
  return safeUser;
}

export async function findUserByEmail(email) {
  const normalised = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalised }).lean();
  return user;
}

export async function findUserById(id) {
  const user = await User.findOne({ id }).lean();
  return user;
}

export async function updateUserStats(id, { analysisCount = 0, itemsSaved = 0, co2Saved = 0 }) {
  await User.findOneAndUpdate(
    { id },
    {
      $inc: {
        analysisCount: analysisCount,
        itemsSaved: itemsSaved,
        co2Saved: co2Saved
      }
    }
  );
}

export async function validatePassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  const { passwordHash: _, _id, __v, ...safeUser } = user;
  return safeUser;
}
