import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env 및 .env.local 파일에서 환경변수 로드 (접두사 제한 없이 모든 변수 로드)
  const env = loadEnv(mode, process.cwd(), '');

  // 로컬 개발 환경에서 process.env에 OPENAI_API_KEY 주입
  if (env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  }

  return {
    plugins: [
      react(),
      {
        name: 'local-vercel-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
            // CORS 및 프리플라이트 처리
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }));
              return;
            }

            // 요청 바디 수집
            let rawBody = '';
            req.on('data', (chunk) => {
              rawBody += chunk;
            });

            req.on('end', async () => {
              try {
                let parsedBody = {};
                if (rawBody) {
                  try {
                    parsedBody = JSON.parse(rawBody);
                  } catch {
                    parsedBody = {};
                  }
                }
                (req as any).body = parsedBody;

                // VercelResponse 인터페이스 호환을 위한 래퍼 구성
                const vercelRes: any = res;
                vercelRes.status = (code: number) => {
                  res.statusCode = code;
                  return vercelRes;
                };
                vercelRes.json = (data: any) => {
                  if (!res.headersSent) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  }
                  res.end(JSON.stringify(data));
                  return vercelRes;
                };

                // Vite의 ssrLoadModule을 통해 루트의 api/chat.ts를 로드하여 핸들러 실행
                const apiModule = await server.ssrLoadModule('/api/chat.ts');
                const handler = apiModule.default;

                if (typeof handler === 'function') {
                  await handler(req, vercelRes);
                } else {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: 'api/chat.ts에 기본 핸들러(default export)가 없습니다.' }));
                }
              } catch (error: any) {
                console.error('[Vite API Middleware Error]:', error);
                if (!res.writableEnded) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      error: error?.message || '로컬 API 처리 중 서버 오류가 발생했습니다.',
                    }),
                  );
                }
              }
            });
          });
        },
      },
    ],
  };
});
