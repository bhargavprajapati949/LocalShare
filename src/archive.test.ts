import assert from 'node:assert/strict';
import test from 'node:test';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ArchiveService } from './infrastructure/archiveService';

async function withTempRoot(run: (rootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-archive-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

test('ArchiveService.getDirectorySize calculates size correctly', async () => {
  await withTempRoot(async (rootPath) => {
    const service = new ArchiveService();
    await fsp.mkdir(path.join(rootPath, 'dir'));
    await fsp.writeFile(path.join(rootPath, 'dir/a.txt'), 'hello'); // 5 bytes
    await fsp.writeFile(path.join(rootPath, 'dir/b.txt'), 'world'); // 5 bytes
    
    const size = await service.getDirectorySize(path.join(rootPath, 'dir'));
    assert.equal(size, 10);
  });
});

test('ArchiveService.createDirectoryArchive produces a stream', async () => {
  await withTempRoot(async (rootPath) => {
    const service = new ArchiveService();
    const sourcePath = path.join(rootPath, 'dir');
    await fsp.mkdir(sourcePath);
    await fsp.writeFile(path.join(sourcePath, 'a.txt'), 'a');

    const result = await service.createDirectoryArchive(sourcePath, 'test');
    assert.equal(result.filename, 'test.zip');
    assert.ok(result.stream);
    
    // Consume stream briefly to finalize
    await new Promise((resolve) => {
      result.stream.on('data', () => {});
      result.stream.on('end', resolve);
    });
  });
});

test('ArchiveService.createDirectoryArchive rejects files', async () => {
  await withTempRoot(async (rootPath) => {
    const service = new ArchiveService();
    const filePath = path.join(rootPath, 'f.txt');
    await fsp.writeFile(filePath, 'data');
    try {
      await service.createDirectoryArchive(filePath, 'test');
      assert.fail('Should have thrown');
    } catch (e) {
      assert.equal((e as Error).message, 'Source path must be a directory');
    }
  });
});
