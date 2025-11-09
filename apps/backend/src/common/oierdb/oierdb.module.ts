import { Global, Module } from '@nestjs/common';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { OIerDbClient } from '@oierdb/core';
import { parseOIerDbData } from '@oierdb/parser';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { OIERDB_CLIENT, RESULT_TXT_URL, STATIC_JSON_URL } from './oierdb.constants';

@Global()
@Module({
  providers: [
    {
      provide: OIERDB_CLIENT,
      useFactory: async () => {
        const adapter = new IDBAdapter(indexedDB, IDBKeyRange);

        console.time('load data');
        const [result, staticJsonText] = await Promise.all([
          loadDataFile('data/result.txt', RESULT_TXT_URL),
          loadDataFile('data/static.json', STATIC_JSON_URL),
        ]);
        console.timeEnd('load data');

        console.time('parse data');
        const parseResult = parseOIerDbData(result, staticJsonText);
        console.timeEnd('parse data');
        console.log(
          `oiers=${parseResult.oiers.length}`,
          `schools=${parseResult.schools.length}`,
          `contests=${parseResult.contests.length}`,
          `records=${parseResult.records.length}`,
        );

        console.time('load data into db');
        await adapter.loadData(parseResult);
        console.timeEnd('load data into db');

        const cacheEnabled = process.env.NODE_ENV === 'production';
        if (cacheEnabled) {
          console.log('OIerDb client cache is ENABLED');
        } else {
          console.log('OIerDb client cache is DISABLED');
        }

        const client = new OIerDbClient(adapter, {
          cache: {
            enabled: cacheEnabled,
            maxSize: 2000,
          },
        });

        return client;
      },
    },
  ],
  exports: [OIERDB_CLIENT],
})
export class OIerDbModule {}

async function loadDataFile(localPath: string, fallbackUrl: string): Promise<string> {
  try {
    return await readFile(join(process.cwd(), localPath), 'utf-8');
  } catch (error) {
    console.warn(`Failed to load local file ${localPath}, falling back to URL: ${fallbackUrl}`);
    if (error instanceof Error) {
      console.warn(`  Error: ${error.message}`);
    }

    const response = await fetch(fallbackUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${fallbackUrl}: ${response.statusText}`);
    }

    return response.text();
  }
}
