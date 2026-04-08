import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  isValidRespondentNameEn,
  normalizeDatasetId,
  type ProgressState,
} from '@/lib/progress-model';
import { getProgressForUser, saveProgressForUser } from '@/lib/progress-repo';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { respondentNameEn, datasetId } = body as { respondentNameEn?: unknown; datasetId?: unknown };

    const nameOk = isValidRespondentNameEn(respondentNameEn);
    const ds = normalizeDatasetId(datasetId);
    // 题库文件在 readable/ 下，由 /api/questions 读取；此处只校验姓名与编号，避免因缺少 JSON 文件而无法保存进度。
    if (!nameOk || ds === null) {
      return NextResponse.json({ error: 'Invalid respondentNameEn or datasetId' }, { status: 400 });
    }

    const prev = await getProgressForUser(userId);
    const key = String(ds);
    const next: ProgressState = {
      ...prev,
      respondentNameEn: String(respondentNameEn).trim(),
      activeDatasetId: ds,
      datasets: {
        ...prev.datasets,
        [key]: prev.datasets[key] ?? { currentIndex: 0, answers: {} },
      },
    };

    await saveProgressForUser(userId, next);
    return NextResponse.json({ success: true, progress: next });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
