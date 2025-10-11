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

        console.time('load data');
        const [result, staticJsonText] = await Promise.all([
          fetch(RESULT_TXT_URL).then((res) => res.text()),
          fetch(STATIC_JSON_URL).then((res) => res.text()),
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
