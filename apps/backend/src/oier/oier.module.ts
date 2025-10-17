import { Module } from '@nestjs/common';
import { OIerController } from './oier.controller';
import { OIerService } from './oier.service';

@Module({
  controllers: [OIerController],
  providers: [OIerService],
  exports: [OIerService],
})
export class OIerModule {}
