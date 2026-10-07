import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Load the optional shared development environment without passing an env-file
// CLI flag: Next forwards Node CLI options to its worker via NODE_OPTIONS.
try {
  loadEnvFile(fileURLToPath(new URL('../../api/.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

createRequire(import.meta.url)('next/dist/bin/next');
