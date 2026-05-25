import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { TtsProviderFactory } from './tts-provider.factory';
import { MinimaxTtsProvider } from './providers/minimax-tts.provider';
import { CartesiaTtsProvider } from './providers/cartesia-tts.provider';
import { FileAssetsModule } from '../file-assets/file-assets.module';

@Module({
  imports: [PrismaModule, MulterModule.register(), FileAssetsModule],
  controllers: [TtsController],
  providers: [
    TtsService,
    TtsProviderFactory,
    MinimaxTtsProvider,
    CartesiaTtsProvider,
  ],
  exports: [TtsService],
})
export class TtsModule {}
