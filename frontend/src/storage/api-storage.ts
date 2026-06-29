/**
 * ApiStorage - the default {@link IStorageService} backing.
 *
 * A thin delegation layer over the existing typed `api` client. It adds no
 * behaviour; its only job is to put the data access behind the interface so
 * a second backing (DexieStorage) can be swapped in later without touching
 * the consuming components.
 */
import {api} from "../api/client";
import type {BackupImportResult, IStorageService} from "./types";

export class ApiStorage implements IStorageService {
  settings = {
    getApp: (): Promise<Record<string, unknown>> => api.settings.getApp(),
    updateApp: (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
      api.settings.updateApp(data),
  };

  backup = {
    exportUrl: (includeAudiobook = false): string => api.backup.exportUrl(includeAudiobook),
    import: (file: File): Promise<BackupImportResult> => api.backup.import(file),
  };
}
