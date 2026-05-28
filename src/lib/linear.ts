import { LinearClient } from '@linear/sdk';

let _client: LinearClient | null = null;
let _teamIdPromise: Promise<string> | null = null;

export function linear() {
  if (_client) return _client;
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY missing — set it in .env.local');
  _client = new LinearClient({ apiKey });
  return _client;
}

/** Resolve a Linear user ID from an email, display name, full name, or "me".
 *  Returns null if no match. Caches resolved lookups for the process lifetime. */
const _userCache = new Map<string, string | null>();
export async function resolveUserId(query: string): Promise<string | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (_userCache.has(key)) return _userCache.get(key)!;
  const client = linear();
  if (key === 'me') {
    const me = await client.viewer;
    _userCache.set(key, me.id);
    return me.id;
  }
  const users = await client.users();
  const match = users.nodes.find((u) => {
    const email = u.email?.toLowerCase() ?? '';
    const display = u.displayName?.toLowerCase() ?? '';
    const name = u.name?.toLowerCase() ?? '';
    return email === key || display === key || name === key;
  });
  const id = match?.id ?? null;
  _userCache.set(key, id);
  return id;
}

/** Resolve the Linear team for new issues.
 *  Prefers env LINEAR_TEAM_KEY (e.g. "BEN"), falls back to the first team. */
export function defaultTeamId(): Promise<string> {
  if (_teamIdPromise) return _teamIdPromise;
  _teamIdPromise = (async () => {
    const teams = await linear().teams();
    const preferKey = (process.env.LINEAR_TEAM_KEY ?? 'BEN').toUpperCase();
    const match = teams.nodes.find((t) => t.key?.toUpperCase() === preferKey);
    const team = match ?? teams.nodes[0];
    if (!team) throw new Error('No teams accessible to this Linear API key');
    return team.id;
  })();
  return _teamIdPromise;
}
