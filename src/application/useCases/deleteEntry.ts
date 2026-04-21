import type { FileSystemPort } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { DomainError } from '../../domain/errors';
import { ShareSessionError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';

export class DeleteEntryUseCase {
  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  async execute(rootId: string, relPath: string): Promise<Result<void>> {
    if (!this.session.isSharingActive()) {
      return err(new ShareSessionError());
    }

    const safeRelPath = String(relPath || '').trim();
    if (!safeRelPath) {
      return err(new DomainError('INVALID_PATH', 'Path is required'));
    }

    const targetResult = this.fileSystem.resolveTarget(rootId, safeRelPath);
    if (!targetResult.ok) {
      return targetResult;
    }

    const deleteResult = await this.fileSystem.deleteEntry(targetResult.value);
    if (!deleteResult.ok) {
      return deleteResult;
    }

    return ok(undefined);
  }
}
