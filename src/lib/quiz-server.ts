import fs from 'fs';
import path from 'path';

export function getDatasetFile(datasetId: number | null, cwd = process.cwd()): string | null {
  if (datasetId === null || datasetId === undefined) return null;
  if (!Number.isInteger(datasetId) || datasetId < 1 || datasetId > 40) return null;
  const part = String(datasetId).padStart(2, '0');
  return path.join(cwd, 'readable', `data${part}.json`);
}

export function loadQuestionsForDataset(datasetId: number | null, cwd = process.cwd()) {
  const filePath = getDatasetFile(datasetId, cwd);
  if (!filePath || !fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Array<{
    sample_id: unknown;
    dialogue_lines?: unknown;
  }>;
  return raw.map((item) => ({
    id: item.sample_id,
    text: Array.isArray(item.dialogue_lines) ? item.dialogue_lines.join('\n\n') : String(item.dialogue_lines ?? ''),
  }));
}
