import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './tts-provider.factory';
import { SttProviderFactory } from './stt/stt-provider.factory';
import { MinimaxTtsProvider } from './providers/minimax-tts.provider';
import { CartesiaTtsProvider } from './providers/cartesia-tts.provider';
import { HumeTtsProvider } from './providers/hume-tts.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import { WhisperSttProvider } from './stt/whisper-stt.provider';
import { TencentSttProvider } from './stt/tencent-stt.provider';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { AiModelModule } from '../ai-model/ai-model.module';

@Module({
  imports: [PrismaModule, MulterModule.register(), FileAssetsModule, AiModelModule],
  controllers: [TtsController],
  providers: [
    TtsService,
    TtsProviderFactory,
    SttProviderFactory,
    MinimaxTtsProvider,
    CartesiaTtsProvider,
    HumeTtsProvider,
    ElevenLabsTtsProvider,
    WhisperSttProvider,
    TencentSttProvider,
  ],
  exports: [TtsService],
})
export class TtsModule {}
