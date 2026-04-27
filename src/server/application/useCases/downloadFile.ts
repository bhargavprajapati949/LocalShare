/**
 * Download File Use Case
 * 
 * Application layer orchestration for file download.
 * Enforces business rules: sharing must be active, path must be valid and point to a file.
 */

import type { FileSystemPort, ResolvedTarget } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { ShareSessionError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';

/**
 * Download file use case
 * 
 * Coordinates path validation, session check, and stream preparation.
 */
export class DownloadFileUseCase {
  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  /**
   * Execute download operation
   * @param rootId - Which share root
   * @param relPath - Relative path within root
   * @returns Stream and metadata ready for HTTP response
   */
  async execute(
    rootId: string,
    relPath: string,
  ): Promise<
    Result<{
      target: ResolvedTarget;
      stream: NodeJS.ReadableStream;
      mimeType: string;
      filename: string;
      size: number;
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

    // Verify it's a file
    const statsResult = await this.fileSystem.statTarget(target);
    if (!statsResult.ok) {
      return statsResult;
    }

    if (!statsResult.value.isFile) {
      return err(new Error('Requested path is not a file') as any);
    }

    // Prepare stream and metadata
    const stream = this.fileSystem.createDownloadStream(target.absPath);
    const mimeType = this.fileSystem.getContentType(target.absPath);
    const filename = target.absPath.split('/').pop() || 'download';

    return ok({
      target,
      stream,
      mimeType,
      filename,
      size: statsResult.value.size,
    });
  }
}
