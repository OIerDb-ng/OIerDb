#!/usr/bin/env tsx
import { existsSync } from 'fs';
import { join } from 'path';

const SCHEMA_FILE = join(__dirname, '..', 'generated', 'schema.ts');

function checkGenerated() {
  if (!existsSync(SCHEMA_FILE)) {
    console.error('❌ Error: Generated OpenAPI types not found!');
    console.error('');
    console.error('Please generate the types first by running:');
    console.error('  yarn generate');
    console.error('');
    console.error('Make sure the backend is running at http://localhost:3000');
    console.error('or set BACKEND_URL environment variable to the correct URL.');
    process.exit(1);
  }

  console.log('✓ Generated OpenAPI types found');
}

checkGenerated();
