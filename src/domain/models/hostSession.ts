/**
 * Host Session Domain Model
 * 
 * Manages the lifecycle of file sharing (active/stopped state).
 * Implements HostSessionPort for dependency injection.
 */

import type { HostSessionPort } from '../ports';

/** Session snapshot returned by port operations */
export interface HostSessionSnapshot {
  readonly sharingActive: boolean;
  readonly lastStartedAt: string;
  readonly lastStoppedAt?: string;
}

/**
 * Domain model for host sharing session
 * 
 * Tracks state transitions and maintains history of start/stop events.
 * Thread-safe for single-threaded Node.js.
 */
export class HostSessionState implements HostSessionPort {
  private sharingActive = true;
  private lastStartedAt = new Date().toISOString();
  private lastStoppedAt?: string;
  private customDomainName?: string;

  /**
   * Start sharing (idempotent)
   * @returns Updated session state
   */
  public startSharing(): HostSessionSnapshot {
    if (!this.sharingActive) {
      this.sharingActive = true;
      this.lastStartedAt = new Date().toISOString();
    }

    return this.getSnapshot();
  }

  /**
   * Stop sharing (idempotent)
   * @returns Updated session state
   */
  public stopSharing(): HostSessionSnapshot {
    if (this.sharingActive) {
      this.sharingActive = false;
      this.lastStoppedAt = new Date().toISOString();
    }

    return this.getSnapshot();
  }

  /**
   * Check if sharing is currently active
   * @returns true if active
   */
  public isSharingActive(): boolean {
    return this.sharingActive;
  }

  /**
   * Get immutable snapshot of current state
   * @returns Session state
   */
  public getSnapshot(): HostSessionSnapshot {
    return {
      sharingActive: this.sharingActive,
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
    };
  }

  /**
   * Get custom domain name
   * @returns Custom domain name or undefined
   */
  public getDomainName(): string | undefined {
    return this.customDomainName;
  }

  /**
   * Set custom domain name
   * @param domainName - New domain name or undefined to clear
   */
  public setDomainName(domainName: string | undefined): void {
    this.customDomainName = domainName?.trim() || undefined;
  }
}

/**
 * Check if an address is localhost/loopback
 * @param remoteAddress - Address from socket
 * @returns true if loopback (127.0.0.1, ::1, or IPv6-mapped)
 */
export function isLoopbackAddress(remoteAddress?: string | null): boolean {
  if (!remoteAddress) {
    return false;
  }

  return (
    remoteAddress === '::1' ||
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}
