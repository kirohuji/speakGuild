import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AssetsService } from './assets.service';
import { AddWordDto } from './dto/add-word.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('words')
  async getWords(@Req() req: Request, @Query() pagination: PaginationDto) {
    const session = await requireAuthSession(req);
    return this.assetsService.getWords(session.user.id, pagination);
  }

  @Post('words')
  async addWord(@Req() req: Request, @Body() dto: AddWordDto) {
    const session = await requireAuthSession(req);
    return this.assetsService.addWord(session.user.id, dto);
  }

  @Delete('words/:term')
  async removeWord(@Req() req: Request, @Param('term') term: string) {
    const session = await requireAuthSession(req);
    return this.assetsService.removeWord(session.user.id, term);
  }
}
