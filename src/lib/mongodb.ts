import { MongoClient, Db } from 'mongodb';
import { expandMongoDbSrvToStandard } from './expand-mongodb-srv';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string | undefined {
  return process.env.MONGODB_URI;
}

/** 供调试或高级用法；一般业务请用 {@link getMongoDb} */
export function getMongoClientPromise(): Promise<MongoClient> | null {
  const uri = getUri();
  if (!uri) return null;

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = (async () => {
      let connectUri = uri;
      if (uri.startsWith('mongodb+srv://')) {
        try {
          // 驱动内置的 mongodb+srv 会单独做 queryTxt，部分网络下会 ETIMEOUT；
          // 先用 Node dns 展开为 mongodb:// 再连接，通常可与 diag 里 dns_srv 行为一致。
          connectUri = await expandMongoDbSrvToStandard(uri);
        } catch {
          connectUri = uri;
        }
      }
      const client = new MongoClient(connectUri, { family: 4 });
      return client.connect();
    })();
  }
  return global._mongoClientPromise;
}

export async function getMongoDb(): Promise<Db | null> {
  const p = getMongoClientPromise();
  if (!p) return null;
  const client = await p;
  return client.db(process.env.MONGODB_DB_NAME ?? 'iaa_quiz');
}
