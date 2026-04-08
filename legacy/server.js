const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'progress.json');
const DEFAULT_DATASET_ID = null;

function createEmptyProgress() {
  return {
    respondentNameEn: '',
    activeDatasetId: DEFAULT_DATASET_ID,
    datasets: {}
  };
}

function getDatasetFile(datasetId) {
  if (datasetId === null || datasetId === undefined || datasetId === '') return null;
  const n = Number(datasetId);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  const part = String(n).padStart(2, '0');
  return path.join(__dirname, 'readable', `step3_part${part}_20_readable.json`);
}

function loadQuestionsForDataset(datasetId) {
  const filePath = getDatasetFile(datasetId);
  if (!filePath) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return raw.map((item) => ({
    id: item.sample_id,
    text: Array.isArray(item.dialogue_lines) ? item.dialogue_lines.join('\n\n') : String(item.dialogue_lines ?? '')
  }));
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createEmptyProgress()));
  }
}

function normalizeDatasetsMap(datasets) {
  if (!datasets || typeof datasets !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(datasets)) {
    const id = normalizeDatasetId(k);
    if (id === null) continue;
    const currentIndex = Number.isInteger(v?.currentIndex) ? v.currentIndex : 0;
    const answers = (v?.answers && typeof v.answers === 'object') ? v.answers : {};
    out[id] = { currentIndex, answers };
  }
  return out;
}

function migrateOldProgressIfNeeded(data) {
  if (data && typeof data === 'object' && data.datasets && typeof data.datasets === 'object') {
    const respondentNameEn = typeof data.respondentNameEn === 'string' ? data.respondentNameEn : '';
    const activeDatasetId = (data.activeDatasetId === null || data.activeDatasetId === undefined) ? DEFAULT_DATASET_ID : data.activeDatasetId;
    return {
      respondentNameEn,
      activeDatasetId: normalizeDatasetId(activeDatasetId),
      datasets: normalizeDatasetsMap(data.datasets)
    };
  }

  // legacy schema: { currentIndex, answers, respondentNameEn, datasetId }
  const legacyDatasetId = normalizeDatasetId(data?.datasetId);
  const respondentNameEn = typeof data?.respondentNameEn === 'string' ? data.respondentNameEn : '';
  const currentIndex = Number.isInteger(data?.currentIndex) ? data.currentIndex : 0;
  const answers = (data?.answers && typeof data.answers === 'object') ? data.answers : {};

  const migrated = createEmptyProgress();
  migrated.respondentNameEn = respondentNameEn;
  migrated.activeDatasetId = legacyDatasetId;
  if (legacyDatasetId !== null) {
    migrated.datasets[legacyDatasetId] = { currentIndex, answers };
  }
  return migrated;
}

function readProgress() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw || !raw.trim()) return createEmptyProgress();
    const data = JSON.parse(raw);
    return migrateOldProgressIfNeeded(data);
  } catch {
    return createEmptyProgress();
  }
}

function writeProgress(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

function isValidRespondentNameEn(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  // allow letters, digits, underscore, hyphen and spaces; must start with a letter
  return /^[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z0-9_-]+)*$/.test(trimmed);
}

function normalizeDatasetId(datasetId) {
  const n = Number(datasetId);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/questions
  if (req.method === 'GET' && url.pathname === '/api/questions') {
    const progress = readProgress();
    const datasetId = progress.activeDatasetId;
    const questions = loadQuestionsForDataset(datasetId);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(questions));
    return;
  }

  // GET /api/progress
  if (req.method === 'GET' && url.pathname === '/api/progress') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(readProgress()));
    return;
  }

  // POST /api/metadata  { respondentNameEn, datasetId }
  if (req.method === 'POST' && url.pathname === '/api/metadata') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { respondentNameEn, datasetId } = JSON.parse(body);
        const nameOk = isValidRespondentNameEn(respondentNameEn);
        const ds = normalizeDatasetId(datasetId);
        const filePath = getDatasetFile(ds);
        if (!nameOk || ds === null || !filePath || !fs.existsSync(filePath)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid respondentNameEn or datasetId' }));
          return;
        }

        const prev = readProgress();
        const next = {
          ...prev,
          respondentNameEn: String(respondentNameEn).trim(),
          activeDatasetId: ds,
          datasets: {
            ...prev.datasets,
            [ds]: prev.datasets?.[ds] ?? { currentIndex: 0, answers: {} }
          }
        };
        writeProgress(next);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, progress: next }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // POST /api/answer
  if (req.method === 'POST' && url.pathname === '/api/answer') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { questionId, answer } = JSON.parse(body);
        const progress = readProgress();
        const ds = normalizeDatasetId(progress.activeDatasetId);
        if (ds === null) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Dataset not selected' }));
          return;
        }

        const datasetProgress = progress.datasets?.[ds] ?? { currentIndex: 0, answers: {} };
        datasetProgress.answers[questionId] = answer;

        const questions = loadQuestionsForDataset(ds);
        const idx = questions.findIndex(q => q.id === questionId);
        if (idx >= 0) datasetProgress.currentIndex = Math.max(datasetProgress.currentIndex, idx);

        const next = {
          ...progress,
          activeDatasetId: ds,
          datasets: { ...progress.datasets, [ds]: datasetProgress }
        };
        writeProgress(next);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // 静态文件：index.html
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const filePath = path.join(__dirname, 'index.html');
    res.setHeader('Content-Type', 'text/html');
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
