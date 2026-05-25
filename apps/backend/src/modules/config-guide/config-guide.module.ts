import { Module } from '@nestjs/common';
import { ConfigGuideController } from './config-guide.controller';
import { ConfigGuideService } from './config-guide.service';

@Module({
  controllers: [ConfigGuideController],
  providers: [ConfigGuideService],
})
export class ConfigGuideModule {}
