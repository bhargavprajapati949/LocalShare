/**
 * WebDAV Integration Tests
 *
 * Tests the WebDAV router against a real temporary file system.
 * Covers OPTIONS, PROPFIND, GET, PUT, MKCOL, DELETE, COPY, MOVE, LOCK, UNLOCK.
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

// ── Test helper ──────────────────────────────────────────────────────────────

async function withDavApp(
  run: (app: any, rootPath: string) => Promise<void>,
  opts: { pin?: string } = {},
): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-dav-test-'));
  try {
    const config: AppConfig = {
      host: '0.0.0.0',
      port: 8080,
      roots: [{ id: '0', name: 'tmp', absPath: tempRoot }],
      mdnsEnabled: false,
      sessionPin: opts.pin,
    };
    const sessionState = new HostSessionState();
    const fileSystem = new FileSystemAdapter(config.roots);
    const { app } = createApp(
      config,
      sessionState,
      fileSystem,
      new ListFilesUseCase(fileSystem, sessionState),
      new DownloadFileUseCase(fileSystem, sessionState),
      new DownloadDirectoryUseCase(fileSystem, sessionState),
      new UploadFileUseCase(fileSystem, sessionState),
      new CreateDirectoryUseCase(fileSystem, sessionState),
      new DeleteEntryUseCase(fileSystem, sessionState),
    );
    await run(app, tempRoot);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

// ── OPTIONS ──────────────────────────────────────────────────────────────────

test('WebDAV OPTIONS returns DAV capability headers', async () => {
  await withDavApp(async (app) => {
    const res = await request(app).options('/dav/0/').expect(200);
    assert.ok(res.headers['dav']?.includes('1'), 'DAV: 1 header expected');
    assert.ok(res.headers['allow']?.includes('PROPFIND'));
  });
});

// ── PROPFIND ─────────────────────────────────────────────────────────────────

test('WebDAV PROPFIND on root returns multistatus with collection', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'hello.txt'), 'hello world');
    const res = await request(app)
      .propfind('/dav/0/')
      .set('Depth', '1')
      .expect(207);

    assert.ok(res.text.includes('<D:multistatus'), 'Should return multistatus XML');
    assert.ok(res.text.includes('hello.txt'), 'Should list hello.txt');
    assert.ok(res.text.includes('<D:collection'), 'Root should be a collection');
  });
});

test('WebDAV PROPFIND Depth 0 returns only self', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'file.txt'), 'data');
    const res = await request(app)
      .propfind('/dav/0/')
      .set('Depth', '0')
      .expect(207);

    assert.ok(!res.text.includes('file.txt'), 'Depth 0 should not list children');
  });
});

test('WebDAV PROPFIND on a file returns its properties', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'doc.txt'), 'content here');
    const res = await request(app)
      .propfind('/dav/0/doc.txt')
      .set('Depth', '0')
      .expect(207);

    assert.ok(res.text.includes('doc.txt'));
    assert.ok(res.text.includes('12')); // content length
  });
});

test('WebDAV PROPFIND on unknown path returns 404', async () => {
  await withDavApp(async (app) => {
    await request(app).propfind('/dav/0/nonexistent.txt').set('Depth', '0').expect(404);
  });
});

// ── GET ──────────────────────────────────────────────────────────────────────

test('WebDAV GET downloads a file', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'data.txt'), 'hello dav');
    const res = await request(app).get('/dav/0/data.txt').expect(200);
    assert.equal(res.text, 'hello dav');
  });
});

test('WebDAV GET on nonexistent file returns 404', async () => {
  await withDavApp(async (app) => {
    await request(app).get('/dav/0/nope.txt').expect(404);
  });
});

// ── HEAD ─────────────────────────────────────────────────────────────────────

test('WebDAV HEAD returns headers without body', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'sample.txt'), 'abc');
    const res = await request(app).head('/dav/0/sample.txt').expect(200);
    assert.equal(res.text, undefined);
    assert.ok(res.headers['content-length']);
  });
});

// ── PUT ──────────────────────────────────────────────────────────────────────

test('WebDAV PUT creates a new file', async () => {
  await withDavApp(async (app, rootPath) => {
    await request(app)
      .put('/dav/0/uploaded.txt')
      .set('Content-Type', 'text/plain')
      .send('put content')
      .expect(201);

    const content = await fsp.readFile(path.join(rootPath, 'uploaded.txt'), 'utf-8');
    assert.equal(content, 'put content');
  });
});

test('WebDAV PUT overwrites an existing file', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'existing.txt'), 'old');
    await request(app)
      .put('/dav/0/existing.txt')
      .set('Content-Type', 'text/plain')
      .send('new content')
      .expect(201);

    const content = await fsp.readFile(path.join(rootPath, 'existing.txt'), 'utf-8');
    assert.equal(content, 'new content');
  });
});

// ── MKCOL ────────────────────────────────────────────────────────────────────

test('WebDAV MKCOL creates a directory', async () => {
  await withDavApp(async (app, rootPath) => {
    await request(app).mkcol('/dav/0/newdir').expect(201);
    const stat = await fsp.stat(path.join(rootPath, 'newdir'));
    assert.ok(stat.isDirectory());
  });
});

test('WebDAV MKCOL on existing directory returns 405', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.mkdir(path.join(rootPath, 'existing'));
    await request(app).mkcol('/dav/0/existing').expect(405);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

test('WebDAV DELETE removes a file', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'todelete.txt'), 'bye');
    await request(app).delete('/dav/0/todelete.txt').expect(204);
    await assert.rejects(() => fsp.stat(path.join(rootPath, 'todelete.txt')));
  });
});

test('WebDAV DELETE removes a directory recursively', async () => {
  await withDavApp(async (app, rootPath) => {
    const dir = path.join(rootPath, 'folder');
    await fsp.mkdir(dir);
    await fsp.writeFile(path.join(dir, 'inner.txt'), 'inner');
    await request(app).delete('/dav/0/folder').expect(204);
    await assert.rejects(() => fsp.stat(dir));
  });
});

test('WebDAV DELETE on nonexistent file returns 404', async () => {
  await withDavApp(async (app) => {
    await request(app).delete('/dav/0/ghost.txt').expect(404);
  });
});

// ── COPY ─────────────────────────────────────────────────────────────────────

test('WebDAV COPY duplicates a file', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'src.txt'), 'copy me');
    await request(app)
      .copy('/dav/0/src.txt')
      .set('Destination', 'http://127.0.0.1:8080/dav/0/dst.txt')
      .expect(204);

    const content = await fsp.readFile(path.join(rootPath, 'dst.txt'), 'utf-8');
    assert.equal(content, 'copy me');
    // Source should still exist
    await assert.doesNotReject(() => fsp.stat(path.join(rootPath, 'src.txt')));
  });
});

// ── MOVE ─────────────────────────────────────────────────────────────────────

test('WebDAV MOVE renames a file', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'old.txt'), 'move me');
    await request(app)
      .move('/dav/0/old.txt')
      .set('Destination', 'http://127.0.0.1:8080/dav/0/new.txt')
      .expect(204);

    const content = await fsp.readFile(path.join(rootPath, 'new.txt'), 'utf-8');
    assert.equal(content, 'move me');
    // Source should be gone
    await assert.rejects(() => fsp.stat(path.join(rootPath, 'old.txt')));
  });
});

// ── LOCK / UNLOCK ────────────────────────────────────────────────────────────

test('WebDAV LOCK returns lock token', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'lockme.txt'), 'lock');
    const res = await request(app)
      .lock('/dav/0/lockme.txt')
      .set('Depth', '0')
      .set('Content-Type', 'application/xml')
      .send(`<?xml version="1.0"?>
<D:lockinfo xmlns:D="DAV:">
  <D:lockscope><D:exclusive/></D:lockscope>
  <D:locktype><D:write/></D:locktype>
  <D:owner><D:href>test-owner</D:href></D:owner>
</D:lockinfo>`)
      .expect(200);

    assert.ok(res.headers['lock-token'], 'Lock-Token header expected');
    assert.ok(res.text.includes('<D:locktoken>'));
  });
});

test('WebDAV UNLOCK removes the lock', async () => {
  await withDavApp(async (app, rootPath) => {
    await fsp.writeFile(path.join(rootPath, 'unlockme.txt'), 'lock');
    const lockRes = await request(app)
      .lock('/dav/0/unlockme.txt')
      .set('Depth', '0')
      .set('Content-Type', 'application/xml')
      .send(`<?xml version="1.0"?>
<D:lockinfo xmlns:D="DAV:">
  <D:lockscope><D:exclusive/></D:lockscope>
  <D:locktype><D:write/></D:locktype>
</D:lockinfo>`)
      .expect(200);

    const lockToken = lockRes.headers['lock-token'];
    assert.ok(lockToken);

    await request(app)
      .unlock('/dav/0/unlockme.txt')
      .set('Lock-Token', lockToken as string)
      .expect(204);
  });
});

// ── PIN Auth ─────────────────────────────────────────────────────────────────

test('WebDAV rejects requests without PIN when PIN is set', async () => {
  await withDavApp(
    async (app) => {
      await request(app).options('/dav/0/').expect(401);
    },
    { pin: '1234' },
  );
});

test('WebDAV accepts requests with correct Basic Auth PIN', async () => {
  await withDavApp(
    async (app) => {
      const encoded = Buffer.from('user:1234').toString('base64');
      await request(app)
        .options('/dav/0/')
        .set('Authorization', `Basic ${encoded}`)
        .expect(200);
    },
    { pin: '1234' },
  );
});

test('WebDAV accepts requests with x-session-pin header', async () => {
  await withDavApp(
    async (app) => {
      await request(app).options('/dav/0/').set('x-session-pin', '1234').expect(200);
    },
    { pin: '1234' },
  );
});

// ── Status exposes webdavUrls ─────────────────────────────────────────────────

test('status response includes webdavEnabled and webdavUrls', async () => {
  await withDavApp(async (app) => {
    const res = await request(app).get('/api/status').expect(200);
    assert.equal(res.body.webdavEnabled, true);
    assert.ok(Array.isArray(res.body.webdavUrls));
  });
});

test('host can disable WebDAV mode via transfer settings', async () => {
  await withDavApp(async (app) => {
    await request(app)
      .post('/api/host/transfer')
      .send({ webdavEnabled: false })
      .expect(200);

    await request(app).options('/dav/0/').expect(503);

    const status = await request(app).get('/api/status').expect(200);
    assert.equal(status.body.webdavEnabled, false);
  });
});
