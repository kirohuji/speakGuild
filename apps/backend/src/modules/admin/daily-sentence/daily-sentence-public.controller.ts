import { Controller, Get, Query } from '@nestjs/common';
import { DailySentenceService } from './daily-sentence.service';

@Controller('daily-sentences')
export class DailySentencePublicController {
  constructor(private readonly dailySentenceService: DailySentenceService) {}

  /** 获取今日句子（公开接口，无需登录） */
  @Get('today')
  async getToday() {
    return this.dailySentenceService.findToday();
  }

  /** 获取指定日期的句子（公开接口） */
  @Get()
  async getByDate(@Query('date') date?: string) {
    if (date) {
      return this.dailySentenceService.findByDate(date);
    }
    return this.dailySentenceService.findToday();
  }
}
