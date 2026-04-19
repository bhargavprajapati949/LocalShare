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

    const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase);
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

    const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase);

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
      const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase);

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

    const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase, uploadFileUseCase);

    const response = await request(app)
      .get('/api/download?root=0&path=sample.txt')
      .set('Range', 'bytes=2-4')
      .expect(206);

    assert.equal(response.headers['accept-ranges'], 'bytes');
    assert.equal(response.headers['content-range'], 'bytes 2-4/6');
    assert.equal(response.text, 'cde');
  });
});
