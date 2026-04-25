/**
 * Result Pattern - Encapsulates success or failure of domain operations
 * 
 * Domain layer operations return Result<T> instead of throwing, allowing
 * clean error handling without try/catch overhead.
 */

import type { DomainError } from './errors';

/**
 * Represents a successful operation with a value
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Represents a failed operation with an error
 */
export interface Err {
  readonly ok: false;
  readonly error: DomainError;
}

/**
 * Result type - either Ok or Err
 * 
 * @example
 * const result = validatePath(userPath, roots);
 * if (result.ok) {
 *   const resolved = result.value; // type-safe access
 * } else {
 *   const errorCode = result.error.code;
 * }
 */
export type Result<T> = Ok<T> | Err;

/**
 * Create a successful result
 * @param value - The successful value
 * @returns Result.Ok with value
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed result
 * @param error - The domain error
 * @returns Result.Err with error
 */
export function err(error: DomainError): Err {
  return { ok: false, error };
}

/**
 * Map over a result's value if successful
 * @param result - The result to map
 * @param fn - Function to transform the value
 * @returns Mapped result or the original error
 */
export function map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
  if (!result.ok) {
    return result;
  }
  return ok(fn(result.value));
}

/**
 * Chain results together (flatMap)
 * @param result - The initial result
 * @param fn - Function that returns a new result
 * @returns New result or first error
 */
export function chain<T, U>(
  result: Result<T>,
  fn: (value: T) => Result<U>,
): Result<U> {
  if (!result.ok) {
    return result;
  }
  return fn(result.value);
}

/**
 * Unwrap a result or throw
 * @param result - The result to unwrap
 * @param fallbackError - Error to throw if Err
 * @returns The value if Ok
 * @throws DomainError if Err
 */
export function unwrap<T>(result: Result<T>, fallbackError?: Error): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

/**
 * Unwrap or return a default value
 * @param result - The result to unwrap
 * @param defaultValue - Value to return if Err
 * @returns The value if Ok, or defaultValue
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (!result.ok) {
    return defaultValue;
  }
  return result.value;
}
