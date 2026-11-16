import { Module } from '@nestjs/common';
import { EnttsTtsProvider } from './providers/entts-tts.provider';

@Module({
  providers: [EnttsTtsProvider],
  exports: [EnttsTtsProvider],
})
export class EnttsProviderModule {}
