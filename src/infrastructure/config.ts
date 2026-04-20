/**
 * Application Configuration
 * 
 * Loads configuration from environment variables.
 * Validated at startup; immutable after loading.
 */

import os from 'node:os';
import path from 'node:path';

/** Represents a shareable directory root */
export interface ShareRoot {
  readonly id: string;
  readonly name: string;
  readonly absPath: string;
}

/** Complete application configuration */
export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly roots: ShareRoot[];
  readonly sessionPin?: string;
  /** Advertise via mDNS/Bonjour on the local network (default: true) */
  readonly mdnsEnabled: boolean;
  /** Custom domain name for mDNS resolution (e.g., "my-files.local") */
  readonly customDomainName?: string;
}

/**
 * Parse SHARE_ROOTS environment variable into ShareRoot array
 * @param input - Comma-separated paths or undefined (defaults to cwd)
 * @returns Array of share roots with resolved absolute paths
 */
function parseRoots(input?: string): ShareRoot[] {
  const rawRoots = (input ?? process.cwd())
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return rawRoots.map((rootPath, index) => {
    const absPath = path.resolve(rootPath);
    return {
      id: String(index),
      name: path.basename(absPath) || absPath,
      absPath,
    };
  });
}

/**
 * Load application configuration from environment
 * @returns Validated AppConfig object
 * @throws Error if invalid configuration
 */
export function loadConfig(): AppConfig {
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 8080);
  const sessionPin = process.env.SESSION_PIN?.trim() || undefined;
  const mdnsEnabled = (process.env.MDNS_ENABLED ?? '1') !== '0';
  const customDomainName = process.env.CUSTOM_DOMAIN_NAME?.trim() || undefined;

  return {
    host,
    port,
    roots: parseRoots(process.env.SHARE_ROOTS),
    sessionPin,
    mdnsEnabled,
    customDomainName,
  };
}

/**
 * Build the default advertised mDNS domain name from the current hostname.
 * @returns Normalized default .local domain name
 */
export function getDefaultMdnsDomainName(): string {
  const baseHost = os.hostname().toLowerCase().replace(/\.local$/, '');
  const rawHost = baseHost.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'lan-file-host';
  return `${rawHost}.local`;
}

/**
 * Get local IPv4 addresses (non-loopback)
 * @returns Array of IP addresses available on network interfaces
 */
export function getLanIPv4Candidates(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses = new Set<string>();

  for (const ifaceEntries of Object.values(interfaces)) {
    if (!ifaceEntries) {
      continue;
    }

    for (const iface of ifaceEntries) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.add(iface.address);
      }
    }
  }

  return Array.from(addresses);
}
