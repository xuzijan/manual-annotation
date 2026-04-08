export const DEFAULT_DATASET_ID: number | null = null;

export type DatasetProgress = {
  currentIndex: number;
  answers: Record<string, unknown>;
};

export type ProgressState = {
  respondentNameEn: string;
  activeDatasetId: number | null;
  datasets: Record<string, DatasetProgress>;
};

export function createEmptyProgress(): ProgressState {
  return {
    respondentNameEn: '',
    activeDatasetId: DEFAULT_DATASET_ID,
    datasets: {},
  };
}

export function normalizeDatasetId(datasetId: unknown): number | null {
  const n = Number(datasetId);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

/** 相对项目根目录的题库路径（与 quiz-server getDatasetFile 文件名一致） */
export function getDatasetReadableRelativePath(datasetId: number | null): string | null {
  if (datasetId === null || datasetId === undefined) return null;
  const n = normalizeDatasetId(datasetId);
  if (n === null) return null;
  const part = String(n).padStart(2, '0');
  return `readable/step3_part${part}_20_readable.json`;
}

function normalizeDatasetsMap(datasets: unknown): ProgressState['datasets'] {
  if (!datasets || typeof datasets !== 'object') return {};
  const out: ProgressState['datasets'] = {};
  for (const [k, v] of Object.entries(datasets)) {
    const id = normalizeDatasetId(k);
    if (id === null) continue;
    const obj = v as { currentIndex?: unknown; answers?: unknown };
    const currentIndex = Number.isInteger(obj?.currentIndex) ? (obj.currentIndex as number) : 0;
    const answers = obj?.answers && typeof obj.answers === 'object' ? (obj.answers as Record<string, unknown>) : {};
    out[String(id)] = { currentIndex, answers };
  }
  return out;
}

export function migrateOldProgressIfNeeded(data: unknown): ProgressState {
  const d = data as Record<string, unknown> | null;
  if (d && typeof d === 'object' && d.datasets && typeof d.datasets === 'object') {
    const respondentNameEn = typeof d.respondentNameEn === 'string' ? d.respondentNameEn : '';
    const activeDatasetId =
      d.activeDatasetId === null || d.activeDatasetId === undefined
        ? DEFAULT_DATASET_ID
        : normalizeDatasetId(d.activeDatasetId);
    return {
      respondentNameEn,
      activeDatasetId,
      datasets: normalizeDatasetsMap(d.datasets),
    };
  }

  const legacyDatasetId = normalizeDatasetId(d?.datasetId);
  const respondentNameEn = typeof d?.respondentNameEn === 'string' ? d.respondentNameEn : '';
  const currentIndex =
    d && Number.isInteger(d.currentIndex) ? (d.currentIndex as number) : 0;
  const answers =
    d?.answers && typeof d.answers === 'object' ? (d.answers as Record<string, unknown>) : {};

  const migrated = createEmptyProgress();
  migrated.respondentNameEn = respondentNameEn;
  migrated.activeDatasetId = legacyDatasetId;
  if (legacyDatasetId !== null) {
    migrated.datasets[String(legacyDatasetId)] = { currentIndex, answers };
  }
  return migrated;
}

export function isValidRespondentNameEn(name: unknown): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /^[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z0-9_-]+)*$/.test(trimmed);
}
