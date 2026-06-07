import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DictionaryService } from './dictionary.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  /** Admin: list dictionary entries with pagination */
  @Get('list')
  async list(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.list({
      search,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: delete a dictionary entry */
  @Delete(':word')
  async deleteWord(@Req() req: Request, @Param('word') word: string) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    await this.dictionaryService.deleteWord(word);
    return { code: 200, message: 'success', data: null };
  }

  /** Prefix search on stored dictionary entries */
  @Get('search/suggestions')
  async search(@Query('q') q: string) {
    const results = await this.dictionaryService.search(q ?? '');
    return { code: 200, message: 'success', data: results };
  }

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
}
