import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DictionaryService } from './dictionary.service';
import { requireAuthSession } from '../auth/session.util';
import {
  ClearPronunciationQueryDto,
  ManualPronunciationDto,
  NormalizePronunciationDto,
  PronunciationAuditQueryDto,
  RefreshPronunciationDto,
} from './dto/pronunciation-audit.dto';

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

  /** Admin: inspect 100 dictionary pronunciations at a time. */
  @Get('pronunciation-audit')
  async pronunciationAudit(@Req() req: Request, @Query() query: PronunciationAuditQueryDto) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.pronunciationAudit(query);
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: replace a word's pronunciation data with one audited provider response. */
  @Post(':word/pronunciation/refresh')
  async refreshPronunciation(
    @Req() req: Request,
    @Param('word') word: string,
    @Body() dto: RefreshPronunciationDto,
  ) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.refreshPronunciation(word, dto.provider, dto.scope);
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: 人工确认当前音标无误后锁定；锁定词不会参与一键批量检查。 */
  @Post(':word/pronunciation/lock')
  async lockPronunciation(@Req() req: Request, @Param('word') word: string, @Body() dto: { locked?: boolean }) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') return { code: 403, message: 'Admin only', data: null };
    const result = await this.dictionaryService.setPronunciationLocked(word, dto.locked !== false);
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: manually replace one accent's IPA while preserving its audio. */
  @Put(':word/pronunciation/manual')
  async saveManualPronunciation(
    @Req() req: Request,
    @Param('word') word: string,
    @Body() dto: ManualPronunciationDto,
  ) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.saveManualPronunciation(word, dto.type, dto.ipa);
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: apply canonical broad-IPA formatting to one accent only. */
  @Put(':word/pronunciation/normalize')
  async normalizePronunciation(
    @Req() req: Request,
    @Param('word') word: string,
    @Body() dto: NormalizePronunciationDto,
  ) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.normalizePronunciation(word, dto.type);
    return { code: 200, message: 'success', data: result };
  }

  /** Admin: clear only one word's pronunciation data. */
  @Delete(':word/pronunciation')
  async clearPronunciation(
    @Req() req: Request,
    @Param('word') word: string,
    @Query() query: ClearPronunciationQueryDto,
  ) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') {
      return { code: 403, message: 'Admin only', data: null };
    }
    const result = await this.dictionaryService.clearPronunciation(word, query.scope);
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
