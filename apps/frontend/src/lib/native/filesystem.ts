// ──────────────────────────────────────────────
// Filesystem 服务 — 设备文件系统读写
// ──────────────────────────────────────────────

import { Filesystem, Directory as FsDirectory, Encoding } from '@capacitor/filesystem';
import type { FilesystemAPI, Directory } from './types';
import { isNative } from './platform';

function dir(d?: Directory): FsDirectory {
  const map: Record<string, FsDirectory> = { Data: FsDirectory.Data, Cache: FsDirectory.Cache, Documents: FsDirectory.Documents, External: FsDirectory.External };
  return map[d || 'Data'] || FsDirectory.Data;
}

class FilesystemService implements FilesystemAPI {
  async readFile(path: string, directory?: Directory): Promise<string> {
    if (!isNative()) throw new Error('[Filesystem] Not available in browser');
    const result = await Filesystem.readFile({ path, directory: dir(directory) });
    return typeof result.data === 'string' ? result.data : (result.data as any);
  }

  async writeFile(options: { path: string; data: string; directory?: Directory }): Promise<void> {
    if (!isNative()) { console.warn('[Filesystem] writeFile not available in browser'); return; }
    await Filesystem.writeFile({ path: options.path, data: options.data, directory: dir(options.directory), recursive: true });
  }

  async deleteFile(options: { path: string; directory?: Directory }): Promise<void> {
    if (!isNative()) return;
    await Filesystem.deleteFile({ path: options.path, directory: dir(options.directory) });
  }

  async exists(path: string, directory?: Directory): Promise<boolean> {
    if (!isNative()) return false;
    try { await Filesystem.stat({ path, directory: dir(directory) }); return true; } catch { return false; }
  }

  async mkdir(options: { path: string; directory?: Directory }): Promise<void> {
    if (!isNative()) return;
    await Filesystem.mkdir({ path: options.path, directory: dir(options.directory), recursive: true });
  }

  async rmdir(options: { path: string; directory?: Directory }): Promise<void> {
    if (!isNative()) return;
    await Filesystem.rmdir({ path: options.path, directory: dir(options.directory), recursive: true });
  }

  async readdir(options: { path: string; directory?: Directory }): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    if (!isNative()) return [];
    const result = await Filesystem.readdir({ path: options.path, directory: dir(options.directory) });
    return result.files.map((f) => ({ name: f.name, type: f.type as 'file' | 'directory' }));
  }

  getTempPath(): string { return 'tmp/'; }
  getAppPath(): string { return 'app/'; }
}

export const filesystem: FilesystemAPI = new FilesystemService();
