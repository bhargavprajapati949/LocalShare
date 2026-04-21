/**
 * Integration Tests for Express Application
 * 
 * Tests HTTP routes with real file system and dependencies.
 * Uses temporary directories for isolation and cleanup.
 */

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './application/appFactory';
import type { AppConfig } from './infrastructure/config';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { HostSessionState } from './domain/models/hostSession';
import { ListFilesUseCase } from './application/useCases/listFiles';
import { DownloadFileUseCase } from './application/useCases/downloadFile';
import { DownloadDirectoryUseCase } from './application/useCases/downloadDirectory';
import { UploadFileUseCase } from './application/useCases/uploadFile';
import { CreateDirectoryUseCase } from './application/useCases/createDirectory';
import { DeleteEntryUseCase } from './application/useCases/deleteEntry';

async function withTempRoot(run: (rootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-app-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

test('status includes host ip candidates and sharing state', async () => {
  await withTempRoot(async (rootPath) => {
    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [
        {
          id: '0',
          name: 'tmp',
          absPath: rootPath,
        },
      ],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);

    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);
    const response = await request(app).get('/api/status').expect(200);

    assert.equal(response.body.sharingActive, true);
    assert.equal(Array.isArray(response.body.lanAddresses), true);
    assert.equal(Array.isArray(response.body.lanUrls), true);
    assert.equal(response.body.port, 8080);
  });
});

test('list route blocks while host sharing is stopped and resumes after start', async () => {
  await withTempRoot(async (rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'demo.txt'), 'hello');

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [
        {
          id: '0',
          name: 'tmp',
          absPath: rootPath,
        },
      ],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);

    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    await request(app).post('/api/host/stop').expect(200);
    await request(app).get('/api/list?root=0&path=').expect(503);

    await request(app).post('/api/host/start').expect(200);
    const listResponse = await request(app).get('/api/list?root=0&path=').expect(200);

    assert.equal(Array.isArray(listResponse.body.entries), true);
    assert.equal(
      listResponse.body.entries.some((entry: { name: string }) => entry.name === 'demo.txt'),
      true,
    );
  });
});

test('host can update shared root at runtime and clients see new directory', async () => {
  await withTempRoot(async (rootA) => {
    const rootB = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-app-test-alt-'));

    try {
      await fsp.writeFile(path.join(rootA, 'only-in-a.txt'), 'alpha');
      await fsp.writeFile(path.join(rootB, 'only-in-b.txt'), 'beta');

      const config: AppConfig = {
        host: '0.0.0.0',
        port: 8080,
        roots: [
          {
            id: '0',
            name: 'root-a',
            absPath: rootA,
          },
        ],
        mdnsEnabled: false,
      };

      const sessionState = new HostSessionState();
      const fileSystem = new FileSystemAdapter(config.roots);
      const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
      const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
      const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
      const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
      const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
      const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
      const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

      const before = await request(app).get('/api/list?root=0&path=').expect(200);
      assert.equal(
        before.body.entries.some((entry: { name: string }) => entry.name === 'only-in-a.txt'),
        true,
      );

      await request(app)
        .post('/api/host/share-root')
        .send({ absPath: rootB })
        .expect(200);

      const after = await request(app).get('/api/list?root=0&path=').expect(200);
      assert.equal(
        after.body.entries.some((entry: { name: string }) => entry.name === 'only-in-a.txt'),
        false,
      );
      assert.equal(
        after.body.entries.some((entry: { name: string }) => entry.name === 'only-in-b.txt'),
        true,
      );
    } finally {
      await fsp.rm(rootB, { recursive: true, force: true });
    }
  });
});

test('download endpoint supports HTTP range requests for resumable downloads', async () => {
  await withTempRoot(async (rootPath) => {
    const filePath = path.join(rootPath, 'sample.txt');
    await fsp.writeFile(filePath, 'abcdef');

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [
        {
          id: '0',
          name: 'tmp',
          absPath: rootPath,
        },
      ],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);

    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    const response = await request(app)
      .get('/api/download?root=0&path=sample.txt')
      .set('Range', 'bytes=2-4')
      .expect(206);

    assert.equal(response.headers['accept-ranges'], 'bytes');
    assert.equal(response.headers['content-range'], 'bytes 2-4/6');
    assert.equal(response.text, 'cde');
  });
});

test('list route supports sorting by name/size/date', async () => {
  await withTempRoot(async (rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'b-file.txt'), 'bbbb');
    await new Promise((r) => setTimeout(r, 10));
    await fsp.writeFile(path.join(rootPath, 'a-file.txt'), 'a');

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    const byName = await request(app).get('/api/list?root=0&path=&sortBy=name&sortDir=asc').expect(200);
    assert.equal(byName.body.entries[0].name, 'a-file.txt');

    const bySize = await request(app).get('/api/list?root=0&path=&sortBy=size&sortDir=desc').expect(200);
    assert.equal(bySize.body.entries[0].name, 'b-file.txt');

    const byDate = await request(app).get('/api/list?root=0&path=&sortBy=date&sortDir=desc').expect(200);
    assert.equal(byDate.body.entries[0].name, 'a-file.txt');
  });
});

test('can create and delete directory via file browsing APIs', async () => {
  await withTempRoot(async (rootPath) => {
    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    await request(app)
      .post('/api/fs/mkdir')
      .send({ root: '0', path: '', name: 'new-folder' })
      .expect(200);

    const listAfterCreate = await request(app).get('/api/list?root=0&path=').expect(200);
    assert.equal(listAfterCreate.body.entries.some((e: { name: string }) => e.name === 'new-folder'), true);

    await request(app)
      .delete('/api/fs/entry?root=0&path=new-folder')
      .expect(200);

    const listAfterDelete = await request(app).get('/api/list?root=0&path=').expect(200);
    assert.equal(listAfterDelete.body.entries.some((e: { name: string }) => e.name === 'new-folder'), false);
  });
});

test('modify/delete toggles are enforced by APIs', async () => {
  await withTempRoot(async (rootPath) => {
    await fsp.mkdir(path.join(rootPath, 'to-delete'));

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    await request(app)
      .post('/api/host/transfer')
      .send({ modifyEnabled: false, deleteEnabled: false })
      .expect(200);

    await request(app)
      .post('/api/fs/mkdir')
      .send({ root: '0', path: '', name: 'blocked' })
      .expect(403);

    await request(app)
      .delete('/api/fs/entry?root=0&path=to-delete')
      .expect(403);
  });
});

test('transfer settings include read policy and persist updates', async () => {
  await withTempRoot(async (rootPath) => {
    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    const before = await request(app).get('/api/host/transfer').expect(200);
    assert.equal(before.body.readEnabled, true);

    const updated = await request(app)
      .post('/api/host/transfer')
      .send({ readEnabled: false })
      .expect(200);

    assert.equal(updated.body.readEnabled, false);
  });
});

test('read policy blocks list and download endpoints when disabled', async () => {
  await withTempRoot(async (rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'sample.txt'), 'hello-world');
    await fsp.mkdir(path.join(rootPath, 'dir-a'));
    await fsp.writeFile(path.join(rootPath, 'dir-a', 'inside.txt'), 'x');

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    await request(app)
      .post('/api/host/transfer')
      .send({ readEnabled: false })
      .expect(200);

    await request(app).get('/api/list?root=0&path=').expect(403);
    await request(app).get('/api/download?root=0&path=sample.txt').expect(403);
    await request(app).get('/api/download-directory?root=0&path=dir-a').expect(403);
  });
});

test('granular write permissions block upload/create/delete independently', async () => {
  await withTempRoot(async (rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'to-delete.txt'), 'x');

    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: rootPath }],
      mdnsEnabled: false,
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);
    const { app } = createApp(config, sessionState, fileSystem, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase, createDirectoryUseCase, deleteEntryUseCase);

    await request(app)
      .post('/api/host/transfer')
      .send({ uploadEnabled: false, createEnabled: false, deleteEnabled: false })
      .expect(200);

    await request(app)
      .post('/api/fs/mkdir')
      .send({ root: '0', path: '', name: 'blocked' })
      .expect(403);

    await request(app)
      .delete('/api/fs/entry?root=0&path=to-delete.txt')
      .expect(403);

    await request(app)
      .post('/api/upload/resumable/init')
      .send({ filename: 'x.txt', size: 1, root: '0', path: '' })
      .expect(403);
  });
});
