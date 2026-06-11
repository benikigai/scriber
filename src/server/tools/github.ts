type GitHubPullRequest = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  user?: { login?: string };
  head: { sha: string; ref: string };
  base: { ref: string; repo?: { full_name?: string } };
  mergeable?: boolean | null;
  mergeable_state?: string;
  updated_at: string;
};

type GitHubStatus = {
  state: string;
  statuses?: { context: string; state: string; target_url?: string; description?: string }[];
};

type GitHubCheckRuns = {
  check_runs?: { name: string; status: string; conclusion: string | null; html_url?: string }[];
};

export function githubConfigured() {
  return Boolean(githubToken() && process.env.GITHUB_DEFAULT_REPO);
}

export async function listGitHubPullRequests(args: Record<string, unknown>) {
  const repo = normalizeRepo(args.repo ?? process.env.GITHUB_DEFAULT_REPO);
  const state = normalizeState(args.state);
  const limit = boundedNumber(args.limit, 8, 1, 20);
  const prs = await githubFetch<GitHubPullRequest[]>(`/repos/${repo}/pulls?${new URLSearchParams({ state, per_page: String(limit) })}`);
  return {
    repo,
    pull_requests: prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? null,
      branch: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      state: pr.state,
      updated_at: pr.updated_at,
      url: pr.html_url,
    })),
  };
}

export async function getGitHubPullRequestStatus(args: Record<string, unknown>) {
  const repo = normalizeRepo(args.repo ?? process.env.GITHUB_DEFAULT_REPO);
  const number = Number(args.number);
  if (!Number.isInteger(number) || number <= 0) throw new Error("number required");

  const pr = await githubFetch<GitHubPullRequest>(`/repos/${repo}/pulls/${number}`);
  const [status, checks] = await Promise.all([
    githubFetch<GitHubStatus>(`/repos/${repo}/commits/${pr.head.sha}/status`).catch(() => null),
    githubFetch<GitHubCheckRuns>(`/repos/${repo}/commits/${pr.head.sha}/check-runs`).catch(() => null),
  ]);

  return {
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? null,
    draft: pr.draft,
    mergeable: pr.mergeable ?? null,
    mergeable_state: pr.mergeable_state ?? null,
    head: { branch: pr.head.ref, sha: pr.head.sha },
    base: pr.base.ref,
    combined_status: status?.state ?? null,
    statuses: status?.statuses ?? [],
    checks:
      checks?.check_runs?.map((check) => ({
        name: check.name,
        status: check.status,
        conclusion: check.conclusion,
        url: check.html_url ?? null,
      })) ?? [],
  };
}

async function githubFetch<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requiredGithubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "scriber-meeting-agent",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as any)?.message ?? `GitHub request failed with ${response.status}`);
  }
  return body as T;
}

function githubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

function requiredGithubToken() {
  const token = githubToken();
  if (!token) throw new Error("GITHUB_TOKEN or GH_TOKEN missing");
  return token;
}

function normalizeRepo(value: unknown) {
  const repo = String(value ?? "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error("repo must be owner/name or set GITHUB_DEFAULT_REPO");
  }
  return repo;
}

function normalizeState(value: unknown) {
  if (value === "closed" || value === "all") return value;
  return "open";
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}
