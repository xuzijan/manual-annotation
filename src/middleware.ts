/**
 * Clerk Quickstart 第 4 步：`clerkMiddleware()`（Next.js 15 使用 `src/middleware.ts`；
 * 若官方文档要求 `proxy.ts`，仅文件名不同，内容可与此处一致。）
 *
 * 在默认「全公开」基础上，本项目对除登录/注册外的路由调用 `auth.protect()`，
 * 未登录用户会跳转登录页；`/api/*` 同样需要登录。
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/debug(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
