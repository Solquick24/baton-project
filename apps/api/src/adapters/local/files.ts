import { constants } from 'node:fs';
import { open, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { ApiError } from '../../shared/errors.js';

function contained(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}
/** Read only a registered file inside the private upload root, never a client-supplied filename. */
export async function openSourceFile(uploadDir: string, storagePath: string, expectedSize: number) {
  let handle: FileHandle | undefined;
  try {
    if (!storagePath || storagePath.includes('\0')) throw new ApiError('not_found');
    // Treat both path separators as separators so Windows traversal is also rejected on Unix.
    if (process.platform !== 'win32' && !isAbsolute(storagePath) && win32.isAbsolute(storagePath)) throw new ApiError('not_found');
    const root = await realpath(uploadDir);
    const candidate = resolve(root, storagePath.replaceAll('\\', '/'));
    if (!contained(root, candidate)) throw new ApiError('not_found');
    const actual = await realpath(candidate);
    if (!contained(root, actual)) throw new ApiError('not_found');
    handle = await open(actual, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expectedSize) throw new ApiError('not_found');
    return { stream: handle.createReadStream({ autoClose: true }), size: stat.size };
  } catch {
    await handle?.close().catch(() => {});
    // Filesystem errors cannot reveal paths, existence outside the root, or originals.
    throw new ApiError('not_found');
  }
}
