import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DictionaryService } from './dictionary.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  /** Public word lookup — triggers pipeline on cache miss */
  @Get(':word')
  async getWord(@Param('word') word: string) {
    const result = await this.dictionaryService.lookupWord(word);
    if (!result) {
      return { code: 404, message: `Word "${word}" not found`, data: null };
    }
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: batch enrich multiple words */
  @Post('batch-enrich')
  async batchEnrich(@Req() req: Request, @Body() dto: { words: string[] }) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.batchEnrich(dto.words ?? []);
    return { code: 200, message: 'success', data: result };
  }

  /** Prefix search on stored dictionary entries */
  @Get('search/suggestions')
  async search(@Query('q') q: string) {
    const results = await this.dictionaryService.search(q ?? '');
    return { code: 200, message: 'success', data: results };
  }
}
