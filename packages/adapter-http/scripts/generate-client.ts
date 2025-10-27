#!/usr/bin/env tsx

import { exec } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const SWAGGER_JSON_PATH = `${BACKEND_URL}/swagger/json`;
const OUTPUT_DIR = join(__dirname, '..', 'generated');
const OUTPUT_FILE = join(OUTPUT_DIR, 'schema.ts');

async function main() {
  console.log('Generating OpenAPI client...');
  console.log(`Fetching OpenAPI schema from: ${SWAGGER_JSON_PATH}`);

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Use openapi-typescript to generate types from the OpenAPI schema
    const command = `npx openapi-typescript "${SWAGGER_JSON_PATH}" -o "${OUTPUT_FILE}"`;

    console.log(`Running: ${command}`);
    const { stdout, stderr } = await execAsync(command);

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✓ OpenAPI types generated successfully at: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Failed to generate OpenAPI client:');
    console.error(error);
    process.exit(1);
  }
}

main();
