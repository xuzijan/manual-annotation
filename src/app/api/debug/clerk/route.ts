import { NextResponse } from 'next/server';

/** 仅开发环境：核对本地读到的 Publishable Key 前缀是否与 Clerk Dashboard → API Keys（Development）一致 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  return NextResponse.json({
    hasPublishableKey: Boolean(pk),
    /** Publishable Key 本就可公开；只返回前缀便于与 Dashboard 对照 */
    publishableKeyPrefix: pk.slice(0, 24),
  });
}
