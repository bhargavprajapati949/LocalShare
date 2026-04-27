import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

function build() {
  console.log('🚀 Starting build process...');

  // 1. Clean dist directory
  console.log('🧹 Cleaning dist directory...');
  try {
    rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
  } catch (err) {
    console.warn('Warning: Could not clean dist directory:', err.message);
  }

  // 2. Run TypeScript compiler
  console.log('⌨️ Compiling TypeScript...');
  const tsc = spawnSync('npx', ['tsc', '-p', 'tsconfig.json'], { 
    stdio: 'inherit',
    shell: true,
    cwd: rootDir
  });

  if (tsc.status !== 0) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
  }

  // 3. Ensure directories exist
  console.log('📁 Creating directories...');
  mkdirSync(path.join(rootDir, 'dist/renderer'), { recursive: true });
  mkdirSync(path.join(rootDir, 'dist/icons'), { recursive: true });

  // 4. Copy assets
  console.log('📄 Copying assets...');
  
  // Copy renderer source
  cpSync(path.join(rootDir, 'src/renderer'), path.join(rootDir, 'dist/renderer'), { recursive: true });
  
  // Copy specific public assets to renderer
  cpSync(path.join(rootDir, 'public/favicon.svg'), path.join(rootDir, 'dist/renderer/favicon.svg'));
  cpSync(path.join(rootDir, 'public/icon.png'), path.join(rootDir, 'dist/renderer/icon.png'));
  
  // Copy icons for packaging
  cpSync(path.join(rootDir, 'public/icons'), path.join(rootDir, 'dist/icons'), { recursive: true });

  console.log('✅ Build completed successfully!');
}

build();
