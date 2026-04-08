import dns from 'dns/promises';
import { NextResponse } from 'next/server';
import { getMongoClientPromise } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/** 从 mongodb+srv://user:pass@host/... 取出 host（密码中不应含未编码的 @） */
function extractMongoSrvHost(uri: string): string | null {
  const m = uri.trim().match(/^mongodb\+srv:\/\/[^@]+@([^/?#]+)/i);
  return m ? m[1].trim() : null;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const steps: Record<string, unknown>[] = [];

  const hasPk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const hasSk = Boolean(process.env.CLERK_SECRET_KEY);
  const mongoUri = process.env.MONGODB_URI;
  const hasMongo = Boolean(mongoUri);
  const host = mongoUri ? extractMongoSrvHost(mongoUri) : null;

  steps.push({
    step: 1,
    name: 'env',
    ok: hasPk && hasSk && hasMongo,
    detail: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: hasPk ? 'set' : 'missing',
      CLERK_SECRET_KEY: hasSk ? 'set' : 'missing',
      MONGODB_URI: hasMongo ? 'set' : 'missing',
      mongodbHostParsed: host,
    },
    hint: hasMongo && !host ? 'MONGODB_URI 格式异常，应为 mongodb+srv://用户:密码@主机/...' : undefined,
  });

  if (host) {
    const srvQuery = `_mongodb._tcp.${host}`;
    const t0 = Date.now();
    try {
      const records = await dns.resolveSrv(srvQuery);
      steps.push({
        step: 2,
        name: 'dns_srv',
        ok: records.length > 0,
        ms: Date.now() - t0,
        detail: {
          query: srvQuery,
          recordCount: records.length,
          firstTarget: records[0]?.name,
        },
        hint:
          records.length === 0
            ? 'SRV 无记录，检查主机名是否与 Atlas 完全一致'
            : undefined,
      });
    } catch (e) {
      steps.push({
        step: 2,
        name: 'dns_srv',
        ok: false,
        ms: Date.now() - t0,
        detail: {
          query: srvQuery,
          error: e instanceof Error ? e.message : String(e),
        },
        hint: '常见于 DNS 慢、路由器 DNS、或需改系统 DNS 为 8.8.8.8；代码已设 MongoClient family:4',
      });
    }
  } else {
    steps.push({
      step: 2,
      name: 'dns_srv',
      ok: false,
      skipped: true,
      detail: { reason: '无法从 MONGODB_URI 解析主机名' },
    });
  }

  if (hasMongo && host) {
    const t0 = Date.now();
    try {
      const p = getMongoClientPromise();
      if (!p) {
        steps.push({
          step: 3,
          name: 'mongo_ping',
          ok: false,
          detail: { error: 'getMongoClientPromise 为 null' },
        });
      } else {
        const client = await p;
        await client.db('admin').command({ ping: 1 });
        const dbName = process.env.MONGODB_DB_NAME ?? 'iaa_quiz';
        const n = await client.db(dbName).collection('progress').estimatedDocumentCount();
        steps.push({
          step: 3,
          name: 'mongo_ping',
          ok: true,
          ms: Date.now() - t0,
          detail: {
            dbName,
            progressCollectionDocCount: n,
          },
        });
      }
    } catch (e) {
      steps.push({
        step: 3,
        name: 'mongo_ping',
        ok: false,
        ms: Date.now() - t0,
        detail: {
          error: e instanceof Error ? e.message : String(e),
        },
        hint:
          String(e).includes('bad auth') || String(e).includes('authentication failed')
            ? '用户名或密码错误，到 Atlas → Database Access 核对或重置密码，URI 中密码需 URL 编码'
            : String(e).includes('ETIMEOUT') || String(e).includes('queryTxt')
              ? '仍偏网络/DNS；试改 DNS、手机热点、或稍后重试'
              : undefined,
      });
    }
  } else {
    steps.push({
      step: 3,
      name: 'mongo_ping',
      ok: false,
      skipped: true,
      detail: { reason: '未设置 MONGODB_URI 或主机名无效' },
    });
  }

  const critical = steps.filter((s) => !s.skipped && s.ok === false);
  const summary = {
    allGreen: critical.length === 0,
    failedSteps: critical.map((s) => (s as { name?: string }).name).filter(Boolean),
    readMe:
      '按 step 1→2→3 看：①环境变量 ②DNS SRV ③Mongo 连接。哪一步 false 就重点查哪一步。',
  };

  return NextResponse.json({ summary, steps }, { status: 200 });
}
