/**
 * Unit Tests for File System Adapter
 * 
 * Tests path traversal protection and file system operations.
 * Uses temporary directories and validates Result pattern.
 */

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import test from 'node:test';
import type { ShareRoot } from './infrastructure/config';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { PathTraversalError } from './domain/errors';

async function withTempRoot(run: (rootPath: string) => Promise<void>): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-file-host-fs-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

test('resolveTarget keeps resolved path inside selected root', async () => {
  await withTempRoot(async (rootPath) => {
    const roots: ShareRoot[] = [
      {
        id: '0',
        name: 'tmp',
        absPath: rootPath,
      },
    ];

    const adapter = new FileSystemAdapter(roots);
    const result = adapter.resolveTarget('0', 'docs/readme.txt');

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.relPath, 'docs/readme.txt');
      assert.equal(result.value.absPath, path.resolve(rootPath, 'docs/readme.txt'));
    }
  });
});

test('resolveTarget rejects path traversal outside selected root', async () => {
  await withTempRoot(async (rootPath) => {
    const roots: ShareRoot[] = [
      {
        id: '0',
        name: 'tmp',
        absPath: rootPath,
      },
    ];

    const adapter = new FileSystemAdapter(roots);
    const result = adapter.resolveTarget('0', '../../etc/passwd');

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert(result.error instanceof PathTraversalError);
    }
  });
});
