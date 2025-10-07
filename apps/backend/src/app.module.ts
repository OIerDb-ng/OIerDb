import { Module } from '@nestjs/common';

import { OIerDbModule } from './common/oierdb/oierdb.module';
import { OierModule } from './oier/oier.module';

@Module({
  imports: [OIerDbModule, OierModule],
})
export class AppModule {}
