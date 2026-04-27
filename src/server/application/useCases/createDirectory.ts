import type { FileSystemPort } from '../../domain/ports';
import type { HostSessionPort } from '../../domain/ports';
import { DomainError } from '../../domain/errors';
import { ShareSessionError } from '../../domain/errors';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';

export class CreateDirectoryUseCase {
  constructor(
    private fileSystem: FileSystemPort,
    private session: HostSessionPort,
  ) {}

  async execute(
    rootId: string,
    relPath: string,
    name: string,
  ): Promise<Result<{ relPath: string }>> {
    if (!this.session.isSharingActive()) {
      return err(new ShareSessionError());
    }

    const targetResult = this.fileSystem.resolveTarget(rootId, relPath);
    if (!targetResult.ok) {
      return targetResult;
    }

    const target = targetResult.value;
    const statsResult = await this.fileSystem.statTarget(target);
    if (!statsResult.ok) {
      return statsResult;
    }

    if (!statsResult.value.isDirectory) {
      return err(new DomainError('NOT_A_DIRECTORY', 'Target path is not a directory'));
    }

    const createResult = await this.fileSystem.createDirectory(target, name);
    if (!createResult.ok) {
      return createResult;
    }

    return ok({ relPath: createResult.value.relPath });
  }
}
