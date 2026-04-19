/**
 * Domain Error Hierarchy
 * 
 * All domain errors inherit from a specific base and signal business logic failures.
 * Never expose implementation details to API consumers.
 */

/** Base domain error for business logic failures */
export class DomainError extends Error {
  readonly code: string;
  readonly statusCode: number = 400;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/** Path traversal or bounds violation */
export class PathTraversalError extends DomainError {
  readonly statusCode: number = 400;

  constructor(message: string) {
    super('PATH_TRAVERSAL_DENIED', message);
    this.name = 'PathTraversalError';
    Object.setPrototypeOf(this, PathTraversalError.prototype);
  }
}

/** Sharing session not active */
export class ShareSessionError extends DomainError {
  readonly statusCode: number = 503;

  constructor(message: string = 'Sharing is currently stopped by host') {
    super('SHARING_INACTIVE', message);
    this.name = 'ShareSessionError';
    Object.setPrototypeOf(this, ShareSessionError.prototype);
  }
}

/** Requested file not found or inaccessible */
export class FileNotFoundError extends DomainError {
  readonly statusCode: number = 404;

  constructor(message: string = 'File not found') {
    super('FILE_NOT_FOUND', message);
    this.name = 'FileNotFoundError';
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

/** Invalid configuration or startup parameters */
export class InvalidConfigError extends DomainError {
  readonly statusCode: number = 500;

  constructor(message: string) {
    super('INVALID_CONFIG', message);
    this.name = 'InvalidConfigError';
    Object.setPrototypeOf(this, InvalidConfigError.prototype);
  }
}

/** Input contract violation */
export class ValidationError extends DomainError {
  readonly statusCode: number = 400;

  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Malformed or invalid path */
export class InvalidPathError extends ValidationError {
  constructor(message: string = 'Invalid path format') {
    super('INVALID_PATH', message);
    this.name = 'InvalidPathError';
    Object.setPrototypeOf(this, InvalidPathError.prototype);
  }
}

/** Missing or invalid auth */
export class MissingAuthError extends ValidationError {
  constructor(message: string = 'Authentication required') {
    super('MISSING_AUTH', message);
    Object.setPrototypeOf(this, MissingAuthError.prototype);
  }
}

/** Invalid query or body params */
export class InvalidParamsError extends ValidationError {
  constructor(message: string) {
    super('INVALID_PARAMS', message);
    this.name = 'InvalidParamsError';
    Object.setPrototypeOf(this, InvalidParamsError.prototype);
  }
}

/** Infrastructure-level error (FS, permission, I/O) */
export class InfrastructureError extends DomainError {
  readonly statusCode: number = 500;
  readonly originalError?: Error;

  constructor(code: string, message: string, originalError?: Error) {
    super(code, message);
    this.name = 'InfrastructureError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, InfrastructureError.prototype);
  }
}

/** File permission or access denied */
export class FileAccessError extends InfrastructureError {
  constructor(message: string, originalError?: Error) {
    super('FILE_ACCESS_DENIED', message, originalError);
    this.name = 'FileAccessError';
    Object.setPrototypeOf(this, FileAccessError.prototype);
  }
}

/** Directory permission or access denied */
export class DirectoryAccessError extends InfrastructureError {
  constructor(message: string, originalError?: Error) {
    super('DIRECTORY_ACCESS_DENIED', message, originalError);
    this.name = 'DirectoryAccessError';
    Object.setPrototypeOf(this, DirectoryAccessError.prototype);
  }
}

/** I/O error during stream or read */
export class StreamError extends InfrastructureError {
  constructor(message: string, originalError?: Error) {
    super('STREAM_ERROR', message, originalError);
    this.name = 'StreamError';
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

/**
 * Check if error is a domain error (not infrastructure).
 * @param error - The error to check
 * @returns true if error is a business logic failure
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Check if error is an infrastructure error (FS, I/O, permissions).
 * @param error - The error to check
 * @returns true if error is infrastructure-level
 */
export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}
