import worker, { BattleRoom, type Env } from './index.ts';
import { resolveGuestMigrationHttp } from './account-guest-migration-http.ts';
import { resolveSocialHttp } from './social-http.ts';

export { BattleRoom };

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
} as const;

function json(data: unknown, status: number, extra?: Readonly<Record<string, string>>): Response {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(CORS_HEADERS)) if (!headers.has(key)) headers.set(key, value);
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'OPTIONS') {
      const social = await resolveSocialHttp(request, env);
      if (social) return json(social.body, social.status, social.headers);
      const migration = await resolveGuestMigrationHttp(request, env.DB);
      if (migration) return json(migration.body, migration.status, migration.headers);
    }
    return worker.fetch(request, env);
  },
};
