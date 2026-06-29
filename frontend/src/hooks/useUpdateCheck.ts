/**
 * React state wrapper around {@link checkForUpdate}. Exposes a `check()`
 * action and the current status; never throws (errors become the "error"
 * state).
 */
import {useCallback, useState} from "react";
import {checkForUpdate, type ReleaseInfo} from "../utils/updateCheck";

export type UpdateCheckState = "idle" | "checking" | "current" | "available" | "error";

export interface UseUpdateCheckOptions {
  owner: string;
  repo: string;
  currentVersion: string;
}

export function useUpdateCheck({owner, repo, currentVersion}: UseUpdateCheckOptions) {
  const [state, setState] = useState<UpdateCheckState>("idle");
  const [latest, setLatest] = useState<ReleaseInfo | null>(null);

  const check = useCallback(async () => {
    setState("checking");
    const result = await checkForUpdate({owner, repo, currentVersion});
    setLatest(result.latest ?? null);
    setState(result.status);
  }, [owner, repo, currentVersion]);

  return {state, latest, check} as const;
}
