import { Module } from '@nestjs/common';
import { OierController } from './oier.controller';
import { OierService } from './oier.service';

@Module({
  controllers: [OierController],
  providers: [OierService],
  exports: [OierService],
})
export class OierModule {}
