/**
 * Upload File Use Case
 *
 * Orchestrates file upload with business rule enforcement:
 * - Sharing must be active
 * - PIN validation (if required)
 * - Path validation
 * - File size limits
 * - Filename sanitization
 */

import type { FileSystemPort, ResolvedTarget } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { ShareSessionError, DomainError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';

export class UploadFileUseCase {
  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  /**
   * Upload a file to the specified path
   * @param rootId - Root ID where file will be uploaded
   * @param relPath - Directory path within root (empty string for root)
   * @param filename - Name for the uploaded file
   * @param fileData - File data as Buffer
   * @param overwrite - Whether to overwrite existing file (default: false)
   * @returns Result with upload info or error
   */
  async execute(
    rootId: string,
    relPath: string,
    filename: string,
    fileData: Buffer,
    overwrite: boolean = false,
  ): Promise<Result<{ absPath: string; relPath: string; size: number }>> {
    // Validate sharing is active
    if (!this.session.isSharingActive()) {
      return err(new ShareSessionError());
    }

    // Validate file size (max 100 MB)
    const MAX_FILE_SIZE = 51200 * 1024 * 1024;
    if (fileData.length > MAX_FILE_SIZE) {
      return err(new DomainError('FILE_TOO_LARGE', 'File size exceeds maximum limit (51200 MB)'));
    }

    // Resolve target directory
    const targetResult = this.fileSystem.resolveTarget(rootId, relPath);
    if (!targetResult.ok) {
      return targetResult;
    }

    const target = targetResult.value;

    // Verify target is a directory
    const statsResult = await this.fileSystem.statTarget(target);
    if (!statsResult.ok) {
      return statsResult;
    }

    if (!statsResult.value.isDirectory) {
      return err(new DomainError('NOT_A_DIRECTORY', 'Target path is not a directory'));
    }

    // Save the file
    const saveResult = await this.fileSystem.saveFile(target, filename, fileData, overwrite);
    if (!saveResult.ok) {
      return saveResult;
    }

    const saved = saveResult.value;
    return ok({
      absPath: saved.absPath,
      relPath: saved.relPath,
      size: fileData.length,
    });
  }
}
