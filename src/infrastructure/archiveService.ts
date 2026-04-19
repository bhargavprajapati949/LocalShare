/**
 * Archive Service
 *
 * Creates ZIP archives of directories for download.
 * Uses archiver package to generate streams.
 */

import archiver from 'archiver';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

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
  ): Promise<{ stream: archiver.Archiver; filename: string }> {
    // Verify source is a directory
    const stat = await fsp.stat(sourcePath);
    if (!stat.isDirectory()) {
      throw new Error('Source path must be a directory');
    }

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Add directory to archive
    archive.directory(sourcePath, archiveName);

    // Return archive stream and filename
    return {
      stream: archive,
      filename: `${archiveName}.zip`,
    };
  }
}
