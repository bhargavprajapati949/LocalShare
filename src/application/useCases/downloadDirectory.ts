/**
 * Download Directory Use Case
 *
 * Application layer orchestration for directory download as ZIP.
 * Enforces business rules: sharing must be active, path must be valid and be a directory.
 */

import type { FileSystemPort, ResolvedTarget } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { ShareSessionError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';
import { ArchiveService } from '../../infrastructure/archiveService';

/**
 * Download directory use case
 *
 * Coordinates path validation, session check, and archive stream preparation.
 */
export class DownloadDirectoryUseCase {
  private archiveService = new ArchiveService();

  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  /**
   * Execute directory download operation
   * @param rootId - Which share root
   * @param relPath - Relative path within root (must be a directory)
   * @returns Stream and metadata ready for HTTP response
   */
  async execute(
    rootId: string,
    relPath: string,
  ): Promise<
    Result<{
      target: ResolvedTarget;
      stream: NodeJS.ReadableStream;
      filename: string;
    }>
  > {
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

    // Verify it's a directory
    const statsResult = await this.fileSystem.statTarget(target);
    if (!statsResult.ok) {
      return statsResult;
    }

    if (!statsResult.value.isDirectory) {
      return err(new Error('Requested path is not a directory') as any);
    }

    // Create archive
    try {
      const { stream, filename } = await this.archiveService.createDirectoryArchive(
        target.absPath,
        target.relPath ? target.relPath.split('/').pop() || 'archive' : 'root',
      );

      return ok({
        target,
        stream,
        filename,
      });
    } catch (error) {
      return err(new Error('Failed to create archive') as any);
    }
  }
}
