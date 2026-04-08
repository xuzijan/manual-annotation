import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel 上 API 路由用 fs 读 readable/ 时，默认不会把该目录打进 Serverless 产物，导致线上「暂无题目」。
  // 见：https://nextjs.org/docs/app/api-reference/config/next-config-js/output#outputfiletracingincludes
  outputFileTracingIncludes: {
    '/api/questions': ['./readable/**/*.json'],
    '/api/answer': ['./readable/**/*.json'],
  },
};

export default nextConfig;
