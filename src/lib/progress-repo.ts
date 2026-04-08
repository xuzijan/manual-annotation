import fs from 'fs';
import path from 'path';
import { getMongoDb } from './mongodb';
import {
  createEmptyProgress,
  migrateOldProgressIfNeeded,
  type ProgressState,
} from './progress-model';

const FILE = path.join(process.cwd(), 'data', 'clerk-progress.json');

type FileRoot = { users: Record<string, ProgressState> };

function ensureDataDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFileStore(): Record<string, ProgressState> {
  try {
    ensureDataDir();
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, 'utf8');
    if (!raw.trim()) return {};
    const j = JSON.parse(raw) as FileRoot;
    if (j && typeof j === 'object' && j.users && typeof j.users === 'object') return j.users;
    return {};
  } catch {
    return {};
  }
}

function writeFileStore(users: Record<string, ProgressState>) {
  ensureDataDir();
  const payload: FileRoot = { users };
  fs.writeFileSync(FILE, JSON.stringify(payload));
}

export async function getProgressForUser(userId: string): Promise<ProgressState> {
  const db = await getMongoDb();
  if (db) {
    const doc = await db.collection('progress').findOne({ clerkUserId: userId });
    if (!doc) return createEmptyProgress();
    const { _id, clerkUserId: _c, ...rest } = doc as Record<string, unknown>;
    void _id;
    void _c;
    return migrateOldProgressIfNeeded(rest);
  }

  const users = readFileStore();
  const u = users[userId];
  return u ? migrateOldProgressIfNeeded(u) : createEmptyProgress();
}

export async function saveProgressForUser(userId: string, data: ProgressState): Promise<void> {
  const db = await getMongoDb();
  if (db) {
    await db.collection('progress').updateOne(
      { clerkUserId: userId },
      { $set: { ...data, clerkUserId: userId, updatedAt: new Date() } },
      { upsert: true }
    );
    return;
  }

  const users = readFileStore();
  users[userId] = data;
  writeFileStore(users);
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}
