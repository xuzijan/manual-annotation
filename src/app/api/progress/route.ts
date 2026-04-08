import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProgressForUser } from '@/lib/progress-repo';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const progress = await getProgressForUser(userId);
  return NextResponse.json(progress);
}
