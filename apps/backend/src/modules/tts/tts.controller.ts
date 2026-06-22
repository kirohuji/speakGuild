import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TtsService } from './tts.service';
import { SynthesizeAssetDto, SynthesizeTextDto } from './dto/synthesize.dto';

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Get('params-schema')
  getParamsSchema() {
    return this.ttsService.getParamsSchema();
  }

  @Post('synthesize-text')
  @HttpCode(HttpStatus.OK)
  synthesizeText(@Body() dto: SynthesizeTextDto) {
    return this.ttsService.synthesizeText(dto);
  }

  @Post('synthesize-asset')
  @HttpCode(HttpStatus.OK)
  synthesizeAsset(@Body() dto: SynthesizeAssetDto) {
    return this.ttsService.synthesizeAsset(dto);
  }

  @Post('transcribe-recording')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', {
    storage: memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 50 }, // 50 MB
  }))
  async transcribeRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language?: string,
  ) {
    if (!file) throw new BadRequestException('未收到音频文件');
    return this.ttsService.transcribeRecording(file.buffer, file.originalname || 'recording.webm', language);
  }
}
