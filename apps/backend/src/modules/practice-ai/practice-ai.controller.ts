import { Body, Controller, Post, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PracticeAiService } from './practice-ai.service';
import { GetFeedbackDto, GetTeachingDto, WordEnrichmentDto } from './dto/get-feedback.dto';

@Controller('practice-ai')
export class PracticeAiController {
  constructor(private readonly service: PracticeAiService) {}

  @Post('feedback')
  async streamFeedback(@Body() dto: GetFeedbackDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.service.streamFeedback(dto, res as any);
  }

  @Post('teach')
  async streamTeaching(@Body() dto: GetTeachingDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.service.streamTeaching(dto, res as any);
  }

  /** 单词增强：中文释义 + 分级例句（JSON 响应，可缓存） */
  @Post('word-enrichment')
  async wordEnrichment(@Body() dto: WordEnrichmentDto) {
    return this.service.enrichWord(dto);
  }
}
