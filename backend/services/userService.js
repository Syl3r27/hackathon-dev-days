import bcrypt from 'bcryptjs';
import {v4 as uuidv4} from 'uuid';
import db from '../lib/db.js';

export async function createUser({name, email,password}){
    const exist = await findUserByEmail(email);
    if(exist) throw Object.assign(new Error('Email already registered'),{status:409});

    const passwordHash = await bcrypt.hash(password,12);

    const user = {
        id:uuidv4(),
        name:name.trim(),
        email:email.toLowerCase().trim(),
        passwordHash,
        createdAt: new Date().toISOString(),
        analysisCount:0,
        itemsSaved:0,
        co2Saved:0

    };

    const insert = db.prepare("INSERT INTO users (id, name, email, passwordHash, createdAt , analysisCount, itemsSaved, co2Saved) VALUES(@id, @name, @email, @passwordHash, @createdAt, @analysisCount, @itemsSaved, @co2Saved)");
    insert.run(user);

    const {passwordHash: _, ...safeUser} = user;
    return safeUser;
}

export async function findUserByEmail(email) {
  const normalised = email.toLowerCase().trim();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(normalised) || null;
}

export async function findUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

export async function updateUserStats(userId, { analysisCount = 0, itemsSaved = 0, co2Saved = 0 }) {
  const user = await findUserById(userId);
  if (!user) return;
  const stmt = db.prepare(`
    UPDATE users 
    SET analysisCount = analysisCount + ?, 
        itemsSaved = itemsSaved + ?, 
        co2Saved = co2Saved + ? 
    WHERE id = ?
  `);
  stmt.run(analysisCount, itemsSaved, co2Saved, userId);
}

export async function validatePassword(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}