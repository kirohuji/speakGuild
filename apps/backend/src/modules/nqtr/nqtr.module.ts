import { Module } from '@nestjs/common';
import { NqtrController } from './nqtr.controller';

@Module({
  controllers: [NqtrController],
})
export class NqtrModule {}
