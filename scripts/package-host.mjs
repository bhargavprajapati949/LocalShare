import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const platformMap = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'win',
};

const mappedPlatform = platformMap[process.platform];
if (!mappedPlatform) {
  console.error(`Unsupported platform: ${process.platform}`);
  process.exit(1);
}

if (process.arch !== 'x64' && process.arch !== 'arm64') {
  console.error(`Unsupported architecture: ${process.arch}`);
  process.exit(1);
}

const target = `node18-${mappedPlatform}-${process.arch}`;
const outputName = `lan-file-host-${mappedPlatform}-${process.arch}${mappedPlatform === 'win' ? '.exe' : ''}`;

mkdirSync('release', { recursive: true });

const result = spawnSync(
  'npx',
  ['pkg', 'dist/server.js', '--target', target, '--output', `release/${outputName}`],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
