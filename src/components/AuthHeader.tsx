'use client';

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

/** Clerk Quickstart 第 5 步：顶栏登录 / 用户菜单（与文档一致） */
export function AuthHeader() {
  return (
    <header className="fixed right-4 top-4 z-50 flex items-center gap-2">
      <SignedOut>
        <SignInButton />
        <SignUpButton />
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </header>
  );
}
