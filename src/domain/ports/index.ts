/**
 * Port interfaces for file system operations
 * 
 * Infrastructure adapters (fileService) implement these contracts.
 * Domain layer depends on these ports, not on implementations.
 */

import type { Result } from '../result';

/** Represents a directory or file entry */
export interface FileListEntry {
  readonly name: string;
  readonly relPath: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly modifiedAt: string;
}

/** Resolved file target with all path information */
export interface ResolvedTarget {
  readonly rootId: string;
  readonly relPath: string;
  readonly absPath: string;
}

/**
 * Port: File system operations
 * 
 * Implementations handle actual FS I/O with proper error handling.
 * Returns Result<T> to avoid throwing across layers.
 */
export interface FileSystemPort {
  /**
   * Resolve and validate a file path within allowed roots
   * @param rootId - Which share root to use
   * @param relPath - Relative path within root
   * @returns Resolved target or path traversal error
   */
  resolveTarget(rootId: string, relPath: string): Result<ResolvedTarget>;

  /**
   * List directory contents, sorted (directories first, then alphabetically)
   * @param target - Resolved target directory
   * @returns Array of entries or access error
   */
  listDirectory(target: ResolvedTarget): Promise<Result<FileListEntry[]>>;

  /**
   * Get file metadata (size, isFile, isDirectory, etc)
   * @param target - Resolved target
   * @returns File stats or not found error
   */
  statTarget(target: ResolvedTarget): Promise<Result<{ isFile: boolean; isDirectory: boolean; size: number }>>;

  /**
   * Create a readable stream for file download
   * @param absPath - Absolute file path
   * @returns Readable stream that may emit error event
   */
  createDownloadStream(absPath: string): NodeJS.ReadableStream;

  /**
   * Get MIME type for a filename
   * @param filename - File name to check
   * @returns MIME type or application/octet-stream
   */
  getContentType(filename: string): string;

  /**
   * Save a file to the specified directory
   * @param targetDir - Resolved target directory where file will be saved
   * @param filename - Name for the file
   * @param data - File data as Buffer
   * @param overwrite - Whether to overwrite existing file (default: false, auto-renames if false)
   * @returns Result with the saved file path or error
   */
  saveFile(targetDir: ResolvedTarget, filename: string, data: Buffer, overwrite?: boolean): Promise<Result<{ absPath: string; relPath: string }>>;

  /**
   * Create a directory under a resolved parent directory
   * @param targetDir - Parent directory target
   * @param name - Directory name (single path segment)
   */
  createDirectory(targetDir: ResolvedTarget, name: string): Promise<Result<{ absPath: string; relPath: string }>>;

  /**
   * Delete file or directory recursively
   * @param target - File or directory target
   */
  deleteEntry(target: ResolvedTarget): Promise<Result<void>>;

  /**
   * Copy a file or directory to a destination within the same root
   * @param source - Resolved source target
   * @param destAbsPath - Absolute destination path (already validated to be in root)
   * @param overwrite - Whether to overwrite existing destination
   */
  copyEntry(source: ResolvedTarget, destAbsPath: string, overwrite: boolean): Promise<Result<void>>;

  /**
   * Move (rename) a file or directory to a destination within the same root
   * @param source - Resolved source target
   * @param destAbsPath - Absolute destination path (already validated to be in root)
   * @param overwrite - Whether to overwrite existing destination
   */
  moveEntry(source: ResolvedTarget, destAbsPath: string, overwrite: boolean): Promise<Result<void>>;
}

/**
 * Port: Path validation and traversal safety
 * 
 * Responsible for ensuring paths cannot escape allowed roots.
 */
export interface PathValidatorPort {
  /**
   * Validate a relative path is safe (no parent directory traversal)
   * @param relPath - Relative path to validate
   * @returns Sanitized path or InvalidPathError
   */
  validateRelPath(relPath: string): Result<string>;

  /**
   * Check if an absolute path is within the allowed root
   * @param rootAbs - Root directory absolute path
   * @param targetAbs - Target absolute path
   * @returns true if target is within root
   */
  isInsideRoot(rootAbs: string, targetAbs: string): boolean;
}

/**
 * Port: Host session lifecycle management
 * 
 * Tracks whether file sharing is currently active or stopped.
 */
export interface HostSessionPort {
  /**
   * Start sharing (idempotent)
   * @returns Updated session snapshot
   */
  startSharing(): {
    readonly sharingActive: boolean;
    readonly lastStartedAt: string;
    readonly lastStoppedAt?: string;
  };

  /**
   * Stop sharing (idempotent)
   * @returns Updated session snapshot
   */
  stopSharing(): {
    readonly sharingActive: boolean;
    readonly lastStartedAt: string;
    readonly lastStoppedAt?: string;
  };

  /**
   * Check if sharing is currently active
   * @returns true if active
   */
  isSharingActive(): boolean;

  /**
   * Get current session snapshot
   * @returns Full session state
   */
  getSnapshot(): {
    readonly sharingActive: boolean;
    readonly lastStartedAt: string;
    readonly lastStoppedAt?: string;
  };

  /**
   * Get custom domain name
   * @returns Custom domain name or undefined
   */
  getDomainName(): string | undefined;

  /**
   * Set custom domain name
   * @param domainName - New domain name or undefined to clear
   */
  setDomainName(domainName: string | undefined): void;

  /**
   * Get runtime session PIN override
   * @returns PIN or undefined if not required
   */
  getSessionPin(): string | undefined;

  /**
   * Set runtime session PIN override
   * @param pin - PIN or undefined to clear
   */
  setSessionPin(pin: string | undefined): void;

  /**
   * Check whether uploads are enabled for clients
   */
  isUploadEnabled(): boolean;

  /**
   * Enable or disable client uploads
   */
  setUploadEnabled(enabled: boolean): void;

  /**
   * Get maximum upload file size in MB
   */
  getMaxUploadSizeMb(): number;

  /**
   * Set maximum upload file size in MB (1-2048 MB)
   */
  setMaxUploadSizeMb(sizeMb: number): void;

  /**
   * Check whether client-side modify operations are enabled (create/upload)
   */
  isModifyEnabled(): boolean;

  /**
   * Enable or disable client-side modify operations
   */
  setModifyEnabled(enabled: boolean): void;

  /**
   * Check whether delete operations are enabled
   */
  isDeleteEnabled(): boolean;

  /**
   * Enable or disable delete operations
   */
  setDeleteEnabled(enabled: boolean): void;

  /**
   * Check whether read operations are enabled (list/download)
   */
  isReadEnabled(): boolean;

  /**
   * Enable or disable read operations (list/download)
   */
  setReadEnabled(enabled: boolean): void;

  /**
   * Check whether WebDAV mode is enabled
   */
  isWebdavEnabled(): boolean;

  /**
   * Enable or disable WebDAV mode
   */
  setWebdavEnabled(enabled: boolean): void;

}
