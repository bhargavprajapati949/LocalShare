/**
 * File System Adapter
 * 
 * Infrastructure layer implementation of FileSystemPort.
 * Handles actual file I/O with proper error handling and path validation.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { lookup as lookupMimeType } from 'mime-types';
import type { FileSystemPort, FileListEntry, ResolvedTarget } from '../domain/ports';
import type { Result } from '../domain/result';
import { ok, err } from '../domain/result';
import {
  PathTraversalError,
  FileAccessError,
  DirectoryAccessError,
  FileNotFoundError,
} from '../domain/errors';
import type { ShareRoot } from './config';

/**
 * File system adapter implementation
 * 
 * Validates paths against allowed roots and provides FS operations.
 */
export class FileSystemAdapter implements FileSystemPort {
  constructor(private roots: ShareRoot[]) {}

  /**
   * Resolve and validate file path within allowed roots
   * @param rootId - Root identifier
   * @param relPath - Relative path
   * @returns Resolved target or path error
   */
  resolveTarget(rootId: string, relPath: string): Result<ResolvedTarget> {
    try {
      // Find root by ID
      const root = this.roots.find((r) => r.id === rootId);
      if (!root) {
        return err(new PathTraversalError('Invalid root selected'));
      }

      // Validate and sanitize relative path
      const safeRelPath = this.sanitizeRelPath(relPath);

      // Resolve absolute path
      const absPath = path.resolve(root.absPath, safeRelPath);

      // Verify it's inside root
      if (!this.isInsideRoot(root.absPath, absPath)) {
        return err(new PathTraversalError('Requested path is outside selected root'));
      }

      return ok({
        rootId,
        relPath: safeRelPath,
        absPath,
      });
    } catch (error) {
      if (error instanceof PathTraversalError) {
        return err(error);
      }
      return err(new PathTraversalError('Failed to resolve path'));
    }
  }

  /**
   * List directory contents
   * @param target - Resolved target
   * @returns Entries sorted (directories first, then alphabetically)
   */
  async listDirectory(target: ResolvedTarget): Promise<Result<FileListEntry[]>> {
    try {
      const dirEntries = await fsp.readdir(target.absPath, { withFileTypes: true });

      const rows = await Promise.all(
        dirEntries.map(async (entry) => {
          const entryAbsPath = path.join(target.absPath, entry.name);
          const stat = await fsp.stat(entryAbsPath);
          const entryRelPath = target.relPath ? `${target.relPath}/${entry.name}` : entry.name;

          return {
            name: entry.name,
            relPath: entryRelPath,
            isDirectory: entry.isDirectory(),
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        }),
      );

      // Sort: directories first, then alphabetically
      return ok(
        rows.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }),
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as any).code;
        if (code === 'ENOENT') {
          return err(new FileNotFoundError('Directory not found'));
        }
        if (code === 'EACCES') {
          return err(new DirectoryAccessError('Permission denied'));
        }
      }
      return err(new DirectoryAccessError('Failed to list directory'));
    }
  }

  /**
   * Get file stats
   * @param target - Resolved target
   * @returns File type and size
   */
  async statTarget(
    target: ResolvedTarget,
  ): Promise<Result<{ isFile: boolean; isDirectory: boolean; size: number }>> {
    try {
      const stat = await fsp.stat(target.absPath);
      return ok({
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        size: stat.size,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as any).code;
        if (code === 'ENOENT') {
          return err(new FileNotFoundError());
        }
        if (code === 'EACCES') {
          return err(new FileAccessError('Permission denied'));
        }
      }
      return err(new FileAccessError('Failed to access file'));
    }
  }

  /**
   * Create readable stream for download
   * @param absPath - Absolute file path
   * @returns Readable stream
   */
  createDownloadStream(absPath: string): fs.ReadStream {
    return fs.createReadStream(absPath);
  }

  /**
   * Get MIME type for filename
   * @param filename - File name
   * @returns MIME type
   */
  getContentType(filename: string): string {
    const mimeType = lookupMimeType(filename);
    return mimeType || 'application/octet-stream';
  }

  /**
   * Check if absolute path is within root
   * @param rootAbs - Root absolute path
   * @param targetAbs - Target absolute path
   * @returns true if target is inside root
   */
  isInsideRoot(rootAbs: string, targetAbs: string): boolean {
    const rel = path.relative(rootAbs, targetAbs);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  /**
   * Save uploaded file to target directory
   * @param targetDir - Resolved target directory
   * @param filename - Name for the file
   * @param data - File data buffer
   * @returns Result with saved file info or error
   */
  async saveUploadedFile(targetDir: ResolvedTarget, filename: string, data: Buffer): Promise<Result<{ absPath: string; relPath: string }>> {
    try {
      // Verify target is a directory
      const stat = await fsp.stat(targetDir.absPath);
      if (!stat.isDirectory()) {
        return err(new FileAccessError('Target is not a directory'));
      }

      // Sanitize filename (prevent directory traversal in filename)
      const safeFilename = path.basename(filename);
      if (!safeFilename || safeFilename === '.') {
        return err(new FileAccessError('Invalid filename'));
      }

      // Build final path
      const absPath = path.join(targetDir.absPath, safeFilename);

      // Verify final path is still within root
      const root = { absPath: targetDir.absPath.split('/').slice(0, -targetDir.relPath.split('/').filter(Boolean).length).join('/') };
      if (!this.isInsideRoot(root.absPath || targetDir.absPath, absPath)) {
        return err(new FileAccessError('File path would escape root'));
      }

      // Write file
      await fsp.writeFile(absPath, data);

      return ok({
        absPath,
        relPath: targetDir.relPath ? `${targetDir.relPath}/${safeFilename}` : safeFilename,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as any).code;
        if (code === 'EACCES') {
          return err(new FileAccessError('Permission denied'));
        }
      }
      return err(new FileAccessError('Failed to save file'));
    }
  }

  /**
   * Validate and sanitize relative path
   * @param relPath - Relative path from user
   * @returns Sanitized path or error
   */
  private sanitizeRelPath(relPath: string): string {
    // Normalize to Unix-like paths
    const unixPath = relPath.replaceAll('\\', '/');
    const segments = unixPath.split('/').filter(Boolean);

    // Reject parent directory traversal attempts
    if (segments.some((segment) => segment === '..')) {
      throw new PathTraversalError('Parent directory traversal is not allowed');
    }

    // Normalize path
    const normalized = path.posix.normalize(`/${unixPath}`);
    return normalized.replace(/^\/+/, '');
  }
}
