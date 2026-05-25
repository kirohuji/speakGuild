import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { QuestionBankService } from './question-bank.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Get('home')
  async getHome(
    @Req() req: Request,
    @Query('mode') mode?: string,
    @Query('keyword') keyword?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.questionBankService.getHome(session.user.id, mode, keyword);
  }
}
