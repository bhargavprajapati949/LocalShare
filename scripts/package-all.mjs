import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const targets = [
  { target: 'node20-linux-x64', output: 'release/localshare-linux-x64' },
  { target: 'node20-macos-arm64', output: 'release/localshare-macos-arm64' },
  { target: 'node20-macos-x64', output: 'release/localshare-macos-x64-intel' },
  { target: 'node20-win-x64', output: 'release/localshare-win-x64.exe' },
];

mkdirSync('release', { recursive: true });

for (const item of targets) {
  console.log(`Packaging ${item.target} -> ${item.output}`);
  const result = spawnSync(
    'npx',
    ['@yao-pkg/pkg', '.', '--public', '--no-bytecode', '--target', item.target, '--output', item.output],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
