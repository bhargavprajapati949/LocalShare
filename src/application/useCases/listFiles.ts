/**
 * List Files Use Case
 * 
 * Application layer orchestration for directory listing operation.
 * Enforces business rules: sharing must be active, path must be valid.
 */

import type { FileSystemPort, ResolvedTarget } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { ShareSessionError } from '../../domain/errors';
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
      return err(new Error('Requested path is not a directory') as any);
    }

    // List directory entries
    const entriesResult = await this.fileSystem.listDirectory(target);
    if (!entriesResult.ok) {
      return entriesResult;
    }

    return ok({
      target,
      entries: entriesResult.value,
    });
  }
}
