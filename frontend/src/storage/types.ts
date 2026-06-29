/**
 * Storage abstraction seam (docs/patterns/01-dual-storage.md).
 *
 * `IStorageService` is the interface every page/component should reach data
 * through, so the SAME UI can run against different backings - the FastAPI
 * backend (ApiStorage, default) or, once an app needs offline/static
 * deployment, a browser IndexedDB implementation (DexieStorage).
 *
 * This is the MINIMAL seam: only the domain-neutral `settings` + `backup`
 * namespaces are typed here as the worked example. Grow the interface one
 * namespace at a time as you migrate components off direct `api.*` calls -
 * that incremental adoption is the whole point (no big-bang rewrite).
 */

export interface BackupImportResult {
  imported_books: number;
  imported_articles?: number;
}

export interface SettingsStorage {
  getApp(): Promise<Record<string, unknown>>;
  updateApp(data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface BackupStorage {
  /** URL to GET the full backup archive (FileResponse with Content-Disposition). */
  exportUrl(includeAudiobook?: boolean): string;
  /** Restore from an uploaded backup archive. */
  import(file: File): Promise<BackupImportResult>;
}

export interface IStorageService {
  settings: SettingsStorage;
  backup: BackupStorage;
}

export type StorageMode = "api" | "dexie";
