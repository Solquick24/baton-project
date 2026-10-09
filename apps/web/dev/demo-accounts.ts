import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// Only the local Vite development server exposes fictitious seed credentials.
export function demoAccounts(): Plugin {
  return {
    name: 'baton-demo-accounts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/__demo/accounts' || req.method !== 'GET') return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const value: unknown = JSON.parse(readFileSync(new URL('../../../fixtures/seed/accounts.json', import.meta.url), 'utf8'));
          if (!value || typeof value !== 'object' || !('demoPassword' in value) || typeof value.demoPassword !== 'string' || !value.demoPassword) throw new Error('Invalid seed');
          res.end(JSON.stringify({ demoPassword: value.demoPassword }));
        } catch {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: '가상 계정을 불러오지 못했어요.' }));
        }
      });
    },
  };
}
