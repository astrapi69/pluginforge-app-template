/**
 * Update check against the latest GitHub Release.
 *
 * Complements the PWA update prompt (which covers the installed web app)
 * for the non-PWA / desktop-launcher case: compares the running version
 * against the newest published GitHub Release. Pure + injectable `fetch`
 * so it is testable without network. No new dependency.
 */
export interface ReleaseInfo {
  version: string;
  url: string;
  name?: string;
  publishedAt?: string;
}

export type UpdateStatus = "current" | "available" | "error";

export interface UpdateResult {
  status: UpdateStatus;
  current: string;
  latest?: ReleaseInfo;
}

function normalize(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal (by major.minor.patch). */
export function compareSemver(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export async function fetchLatestRelease(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReleaseInfo | null> {
  const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: {Accept: "application/vnd.github+json"},
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    tag_name?: unknown;
    html_url?: unknown;
    name?: unknown;
    published_at?: unknown;
  };
  if (typeof body.tag_name !== "string") return null;
  return {
    version: body.tag_name.replace(/^v/i, ""),
    url: typeof body.html_url === "string" ? body.html_url : `https://github.com/${owner}/${repo}/releases`,
    name: typeof body.name === "string" ? body.name : undefined,
    publishedAt: typeof body.published_at === "string" ? body.published_at : undefined,
  };
}

export async function checkForUpdate(options: {
  owner: string;
  repo: string;
  currentVersion: string;
  fetchImpl?: typeof fetch;
}): Promise<UpdateResult> {
  const {owner, repo, currentVersion, fetchImpl} = options;
  try {
    const latest = await fetchLatestRelease(owner, repo, fetchImpl);
    if (!latest) return {status: "error", current: currentVersion};
    const newer = compareSemver(latest.version, currentVersion) > 0;
    return {status: newer ? "available" : "current", current: currentVersion, latest};
  } catch {
    return {status: "error", current: currentVersion};
  }
}
