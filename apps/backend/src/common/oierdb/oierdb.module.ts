import { Global, Module } from '@nestjs/common';
import { IDBAdapter } from '@oierdb/adapter-idb';
import { OIerDbClient } from '@oierdb/core';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';

import { OIERDB_CLIENT } from './oierdb.constants';

@Global()
@Module({
  providers: [
    {
      provide: OIERDB_CLIENT,
      useFactory: async () => {
        const adapter = new IDBAdapter(indexedDB, IDBKeyRange);

        // FIXME: Load initial data into IndexedDB
        await adapter.loadData({
          // TODO: Provide initial data
          oiers: [],
          schools: [],
          contests: [],
          records: [],
          meta: {
            data_version: 'empty',
          },
        });

        const client = new OIerDbClient(adapter, {
          cache: {
            enabled: true,
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
