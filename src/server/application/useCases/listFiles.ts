/**
 * List Files Use Case
 * 
 * Application layer orchestration for directory listing operation.
 * Enforces business rules: sharing must be active, path must be valid.
 */

import type { FileSystemPort, ResolvedTarget } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { DomainError, ShareSessionError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';
import type { FileListEntry } from '../../domain/ports';

/**
 * List files in a directory use case
 * 
 * Dependencies injected via constructor (dependency inversion).
 */
export class ListFilesUseCase {
  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  /**
   * Execute listing operation
   * @param rootId - Which share root
   * @param relPath - Relative path within root
   * @returns Directory entries or error
   */
  async execute(
    rootId: string,
    relPath: string,
    sortBy: 'name' | 'size' | 'date' = 'name',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Promise<Result<{ target: ResolvedTarget; entries: FileListEntry[] }>> {
    // Business rule: sharing must be active
    if (!this.session.isSharingActive()) {
      return err(new ShareSessionError());
    }

    // Validate and resolve path
    const targetResult = this.fileSystem.resolveTarget(rootId, relPath);
    if (!targetResult.ok) {
      return targetResult;
    }

    const target = targetResult.value;

    // Get file stats and verify it's a directory
    const statsResult = await this.fileSystem.statTarget(target);
    if (!statsResult.ok) {
      return statsResult;
    }

    if (!statsResult.value.isDirectory) {
      return err(new DomainError('NOT_A_DIRECTORY', 'Requested path is not a directory'));
    }

    // List directory entries
    const entriesResult = await this.fileSystem.listDirectory(target);
    if (!entriesResult.ok) {
      return entriesResult;
    }

    const sorted = [...entriesResult.value].sort((a, b) => {
      if (sortBy === 'size') {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        const primary = a.size - b.size;
        if (primary !== 0) {
          return sortDir === 'asc' ? primary : -primary;
        }
        const fallback = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? fallback : -fallback;
      }

      if (sortBy === 'date') {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        const ta = new Date(a.modifiedAt).getTime();
        const tb = new Date(b.modifiedAt).getTime();
        const primary = ta - tb;
        if (primary !== 0) {
          return sortDir === 'asc' ? primary : -primary;
        }
        const fallback = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? fallback : -fallback;
      }

      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }

      const primary = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (primary !== 0) {
        return sortDir === 'asc' ? primary : -primary;
      }
      return 0;
    });

    return ok({
      target,
      entries: sorted,
    });
  }
}
