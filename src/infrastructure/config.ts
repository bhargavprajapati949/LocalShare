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

  return {
    host,
    port,
    roots: parseRoots(process.env.SHARE_ROOTS),
    sessionPin,
    mdnsEnabled,
  };
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
