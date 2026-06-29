/**
 * Storage factory (docs/patterns/01-dual-storage.md).
 *
 * `getStorage()` returns the active {@link IStorageService}. The mode is read
 * from `VITE_STORAGE_MODE` at build time:
 *   - "api"   (default): {@link ApiStorage}, talks to the FastAPI backend.
 *   - "dexie" (future):  a browser IndexedDB implementation for offline /
 *                        static deployments. Not implemented in the skeleton;
 *                        requested but absent -> we warn and fall back to api
 *                        so the app still runs, and you implement DexieStorage
 *                        when you adopt the offline mode.
 *
 * Components should call `getStorage().<namespace>.<method>()` instead of
 * `api.*` directly, so they are backing-agnostic.
 */
import {ApiStorage} from "./api-storage";
import type {IStorageService, StorageMode} from "./types";

export type {IStorageService, StorageMode} from "./types";

function resolveMode(): StorageMode {
  const mode = import.meta.env.VITE_STORAGE_MODE;
  return mode === "dexie" ? "dexie" : "api";
}

let instance: IStorageService | null = null;

export function getStorage(): IStorageService {
  if (instance) return instance;
  const mode = resolveMode();
  if (mode === "dexie") {
    // No DexieStorage in the skeleton yet. Fail OPEN to api so the app runs;
    // implement DexieStorage (implements IStorageService) and select it here
    // when you adopt the offline/static deployment mode.
    console.warn(
      "[storage] VITE_STORAGE_MODE=dexie requested but DexieStorage is not " +
        "implemented; falling back to ApiStorage. See docs/patterns/01-dual-storage.md.",
    );
  }
  instance = new ApiStorage();
  return instance;
}

/** Test helper: drop the cached instance so a test can re-resolve the mode. */
export function resetStorageForTests(): void {
  instance = null;
}
