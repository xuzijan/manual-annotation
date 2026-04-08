import dns from 'dns/promises';

/**
 * 解析 mongodb+srv://[user:pass@]host[/path][?query]（单主机名，与 Atlas 一致）。
 * 凭证段保持原样（已含 URL 编码时不再二次编码）。
 */
function parseMongoSrvUri(uri: string): {
  auth: string;
  srvHost: string;
  pathname: string;
  search: string;
} {
  const prefix = 'mongodb+srv://';
  if (!uri.startsWith(prefix)) {
    throw new Error('不是 mongodb+srv URI');
  }
  const rest = uri.slice(prefix.length);

  let creds = '';
  let afterCreds = rest;
  const at = rest.indexOf('@');
  if (at !== -1) {
    creds = rest.slice(0, at);
    afterCreds = rest.slice(at + 1);
  }

  const pathStart = afterCreds.indexOf('/');
  let srvHost: string;
  let pathAndQuery: string;
  if (pathStart === -1) {
    srvHost = afterCreds;
    pathAndQuery = '';
  } else {
    srvHost = afterCreds.slice(0, pathStart);
    pathAndQuery = afterCreds.slice(pathStart);
  }

  let pathname = '';
  let search = '';
  if (pathAndQuery) {
    const qIdx = pathAndQuery.indexOf('?');
    if (qIdx === -1) {
      pathname = pathAndQuery;
    } else {
      pathname = pathAndQuery.slice(0, qIdx);
      search = pathAndQuery.slice(qIdx);
    }
  }

  const auth = creds ? `${creds}@` : '';
  return { auth, srvHost, pathname, search };
}

/**
 * 将 mongodb+srv 展开为 mongodb:// 多主机 URI，使用 Node 自带 DNS 解析 SRV/TXT。
 * 可避免驱动内部 queryTxt 在某些网络下超时（与 resolveSrv 成功但 mongo_ping 仍 ETIMEOUT 的现象一致）。
 */
export async function expandMongoDbSrvToStandard(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) {
    return uri;
  }

  const { auth, srvHost, pathname, search } = parseMongoSrvUri(uri);
  if (!srvHost) {
    throw new Error('mongodb+srv URI 缺少主机名');
  }

  const srvName = `_mongodb._tcp.${srvHost}`;
  const [srvRecords, txtArrays] = await Promise.all([
    dns.resolveSrv(srvName),
    dns.resolveTxt(srvHost).catch(() => [] as string[][]),
  ]);

  srvRecords.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const hostList = srvRecords.map((r) => `${r.name}:${r.port}`).join(',');

  let txtMerged = '';
  if (txtArrays.length > 0) {
    txtMerged = txtArrays.map((chunks) => chunks.join('')).join('');
  }

  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (txtMerged) {
    const fromTxt = new URLSearchParams(txtMerged.startsWith('?') ? txtMerged.slice(1) : txtMerged);
    for (const [k, v] of fromTxt) {
      if (!sp.has(k)) sp.set(k, v);
    }
  }
  if (!sp.has('tls') && !sp.has('ssl')) {
    sp.set('tls', 'true');
  }

  const qs = sp.toString();
  const q = qs ? `?${qs}` : '';
  const path = pathname || '';

  return `mongodb://${auth}${hostList}${path}${q}`;
}
