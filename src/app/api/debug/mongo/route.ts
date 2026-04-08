import { NextResponse } from 'next/server';
import { getMongoClientPromise } from '@/lib/mongodb';

/** 仅开发环境：检测 MONGODB_URI 是否可用、能否 ping 通 Atlas */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json({
      ok: false,
      reason: 'MONGODB_URI 未设置，当前仍使用 data/clerk-progress.json',
    });
  }

  try {
    const p = getMongoClientPromise();
    if (!p) {
      return NextResponse.json({ ok: false, reason: 'getMongoClientPromise returned null' });
    }
    const client = await p;
    await client.db('admin').command({ ping: 1 });
    const dbName = process.env.MONGODB_DB_NAME ?? 'iaa_quiz';
    const db = client.db(dbName);
    const progressCollectionDocCount = await db.collection('progress').estimatedDocumentCount();
    return NextResponse.json({ ok: true, dbName, progressCollectionDocCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg });
  }
}
