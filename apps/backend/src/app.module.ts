import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { OIerDbModule } from './common/oierdb/oierdb.module';
import { OierModule } from './oier/oier.module';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    OIerDbModule,
    OierModule,
  ],
})
export class AppModule {}
