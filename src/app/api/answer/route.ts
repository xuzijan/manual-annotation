import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { normalizeDatasetId, type ProgressState } from '@/lib/progress-model';
import { getProgressForUser, saveProgressForUser } from '@/lib/progress-repo';
import { loadQuestionsForDataset } from '@/lib/quiz-server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { questionId, answer } = body as { questionId?: unknown; answer?: unknown };

    const progress = await getProgressForUser(userId);
    const ds = normalizeDatasetId(progress.activeDatasetId);
    if (ds === null) {
      return NextResponse.json({ error: 'Dataset not selected' }, { status: 400 });
    }

    const key = String(ds);
    const datasetProgress = progress.datasets[key] ?? { currentIndex: 0, answers: {} };
    datasetProgress.answers[String(questionId)] = answer;

    const questions = loadQuestionsForDataset(ds);
    const idx = questions.findIndex((q) => String(q.id) === String(questionId));
    if (idx >= 0) datasetProgress.currentIndex = Math.max(datasetProgress.currentIndex, idx);

    const next: ProgressState = {
      ...progress,
      activeDatasetId: ds,
      datasets: { ...progress.datasets, [key]: datasetProgress },
    };

    await saveProgressForUser(userId, next);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
