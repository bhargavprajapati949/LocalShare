/**
 * Archive Service
 *
 * Creates ZIP archives of directories for download.
 * Uses archiver package to generate streams.
 */

import archiver from 'archiver';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';

/**
 * Archive service for creating ZIP files
 */
export class ArchiveService {
  /**
   * Create a ZIP archive of a directory
   * @param sourcePath - Absolute path to directory to archive
   * @param archiveName - Name for the archive (without .zip extension)
   * @returns Readable stream of ZIP data and the filename
   */
  async createDirectoryArchive(
    sourcePath: string,
    archiveName: string,
  ): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
    // Verify source is a directory
    const stat = await fsp.stat(sourcePath);
    if (!stat.isDirectory()) {
      throw new Error('Source path must be a directory');
    }

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });
    const output = new PassThrough();

    archive.on('warning', (error: Error & { code?: string }) => {
      if (error.code !== 'ENOENT') {
        output.destroy(error);
      }
    });
    archive.on('error', (error: Error) => {
      output.destroy(error);
    });
    archive.pipe(output);

    // Add directory entries and finalize to complete the stream.
    archive.directory(sourcePath, archiveName);
    void archive.finalize();

    // Return archive stream and filename
    return {
      stream: output,
      filename: `${archiveName}.zip`,
    };
  }
}
