import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { QuestionBankAdminService } from './question-bank-admin.service';
import {
  CreateQuestionBankDto, UpdateQuestionBankDto,
  CreateTopicDto, UpdateTopicDto,
  CreateQuestionDto, UpdateQuestionDto,
  QuestionQueryDto,
} from './dto/question-bank-admin.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/question-bank')
export class QuestionBankAdminController {
  constructor(
    private readonly questionBankAdminService: QuestionBankAdminService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  // ─── 题库 (QuestionBank) ──────────────────────────────────

  @Get('banks')
  async listBanks(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.listBanks();
  }

  @Get('banks/:id')
  async getBank(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.getBank(id);
  }

  @Post('banks')
  async createBank(@Req() req: Request, @Body() dto: CreateQuestionBankDto) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.createBank(dto);
  }

  @Patch('banks/:id')
  async updateBank(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionBankDto,
  ) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.updateBank(id, dto);
  }

  @Delete('banks/:id')
  async deleteBank(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.deleteBank(id);
  }

  @Get('provinces')
  async getProvinces(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.getProvinces();
  }

  // ─── 题目分类 (QuestionTopic) ─────────────────────────────

  @Get('topics')
  async listTopics(@Req() req: Request, @Query('bankId') bankId: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.listTopics(bankId);
  }

  @Post('topics')
  async createTopic(@Req() req: Request, @Body() dto: CreateTopicDto) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.createTopic(dto);
  }

  @Patch('topics/:id')
  async updateTopic(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.updateTopic(id, dto);
  }

  @Delete('topics/:id')
  async deleteTopic(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.deleteTopic(id);
  }

  // ─── 题目 (QuestionItem) ──────────────────────────────────

  @Get('items')
  async listItems(@Req() req: Request, @Query() query: QuestionQueryDto) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.listItems(query);
  }

  @Get('items/:id')
  async getItem(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.getItem(id);
  }

  @Post('items')
  async createItem(@Req() req: Request, @Body() dto: CreateQuestionDto) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.createItem(dto);
  }

  @Patch('items/:id')
  async updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.updateItem(id, dto);
  }

  @Delete('items/:id')
  async deleteItem(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.questionBankAdminService.deleteItem(id);
  }
}
