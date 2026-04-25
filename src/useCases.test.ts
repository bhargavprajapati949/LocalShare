import assert from 'node:assert/strict';
import test from 'node:test';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ListFilesUseCase } from './application/useCases/listFiles';
import { CreateDirectoryUseCase } from './application/useCases/createDirectory';
import { DeleteEntryUseCase } from './application/useCases/deleteEntry';
import { DownloadFileUseCase } from './application/useCases/downloadFile';
import { DownloadDirectoryUseCase } from './application/useCases/downloadDirectory';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { HostSessionState } from './domain/models/hostSession';

async function withTempRoot(run: (rootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-uc-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

test('ListFilesUseCase enforces sharing active rule', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new ListFilesUseCase(fs, session);
    
    session.stopSharing();
    const result = await uc.execute('0', '');
    assert.equal(result.ok, false);
    assert.equal((result as any).error.code, 'SHARING_INACTIVE');
  });
});

test('CreateDirectoryUseCase enforces sharing active rule', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new CreateDirectoryUseCase(fs, session);
    
    session.stopSharing();
    const result = await uc.execute('0', '', 'new-folder');
    assert.equal(result.ok, false);
    assert.equal((result as any).error.code, 'SHARING_INACTIVE');
  });
});

test('DeleteEntryUseCase enforces sharing', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new DeleteEntryUseCase(fs, session);
    
    session.stopSharing();
    const result1 = await uc.execute('0', 'some-file.txt');
    assert.equal(result1.ok, false);
    assert.equal((result1 as any).error.code, 'SHARING_INACTIVE');

    session.startSharing();
    await fsp.writeFile(path.join(rootPath, 'file.txt'), 'data');
    const result2 = await uc.execute('0', 'file.txt');
    assert.equal(result2.ok, true);

    // Empty path should fail
    const result3 = await uc.execute('0', '');
    assert.equal(result3.ok, false);
    assert.equal((result3 as any).error.code, 'INVALID_PATH');
  });
});

test('ListFilesUseCase successful listing and path resolution', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new ListFilesUseCase(fs, session);
    
    await fsp.mkdir(path.join(rootPath, 'subdir'));
    await fsp.writeFile(path.join(rootPath, 'a.txt'), 'a');

    const result = await uc.execute('0', '');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.entries.length, 2);
  });
});

test('ListFilesUseCase sorting logic', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new ListFilesUseCase(fs, session);
    
    await fsp.writeFile(path.join(rootPath, 'a.txt'), 'small'); // size 5
    await fsp.writeFile(path.join(rootPath, 'b.txt'), 'very large'); // size 10
    
    // Sort by size desc
    const resSizeDesc = await uc.execute('0', '', 'size', 'desc');
    assert.equal(resSizeDesc.ok, true);
    if (resSizeDesc.ok) {
      assert.equal(resSizeDesc.value.entries[0].name, 'b.txt');
    }

    // Sort by date desc (we wait a bit or use stat mock, but here we just check if it runs)
    const resDateDesc = await uc.execute('0', '', 'date', 'desc');
    assert.equal(resDateDesc.ok, true);
  });
});

test('CreateDirectoryUseCase validation and execution', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc = new CreateDirectoryUseCase(fs, session);
    
    // Success
    const result = await uc.execute('0', '', 'folder');
    assert.equal(result.ok, true);

    // No name
    const result2 = await uc.execute('0', '', '');
    assert.equal(result2.ok, false);
    assert.equal((result2 as any).error.code, 'DIRECTORY_ACCESS_DENIED');
  });
});

test('Download cases success and fail', async () => {
  await withTempRoot(async (rootPath) => {
    const fs = new FileSystemAdapter([{ id: '0', name: 'tmp', absPath: rootPath }]);
    const session = new HostSessionState();
    const uc1 = new DownloadFileUseCase(fs, session);
    const uc2 = new DownloadDirectoryUseCase(fs, session);
    
    await fsp.writeFile(path.join(rootPath, 'f.txt'), 'data');
    await fsp.mkdir(path.join(rootPath, 'd'));

    // Fail due to sharing inactive
    session.stopSharing();
    assert.equal((await uc1.execute('0', 'f.txt')).ok, false);
    assert.equal((await uc2.execute('0', 'd')).ok, false);

    // Success
    session.startSharing();
    const res1 = await uc1.execute('0', 'f.txt');
    assert.equal(res1.ok, true);
    if (res1.ok) {
      assert.equal(res1.value.filename, 'f.txt');
      assert.ok(res1.value.stream);
      (res1.value.stream as any).destroy();
    }

    const res2 = await uc2.execute('0', 'd');
    assert.equal(res2.ok, true);
  });
});
