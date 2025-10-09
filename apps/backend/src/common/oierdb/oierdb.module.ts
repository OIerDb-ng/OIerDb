import { Global, Module } from '@nestjs/common';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { OIerDbClient } from '@oierdb/core';
import { parseOIerDbData } from '@oierdb/parser';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';

import { OIERDB_CLIENT, RESULT_TXT_URL, STATIC_JSON_URL } from './oierdb.constants';

@Global()
@Module({
  providers: [
    {
      provide: OIERDB_CLIENT,
      useFactory: async () => {
        const adapter = new IDBAdapter(indexedDB, IDBKeyRange);

        const [result, staticJsonText] = await Promise.all([
          fetch(RESULT_TXT_URL).then((res) => res.text()),
          fetch(STATIC_JSON_URL).then((res) => res.text()),
        ]);

        const parseResult = parseOIerDbData(result, staticJsonText);

        await adapter.loadData(parseResult);

        const client = new OIerDbClient(adapter, {
          cache: {
            enabled: process.env.NODE_ENV === 'production',
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
