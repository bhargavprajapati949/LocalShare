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
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);

    const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase);
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
    };

    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);

    const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase);

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
