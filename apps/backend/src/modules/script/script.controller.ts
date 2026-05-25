import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ScriptService } from './script.service';
import { ScriptJudgeService } from './script-judge.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('script')
export class ScriptController {
  constructor(
    private readonly scriptService: ScriptService,
    private readonly judgeService: ScriptJudgeService,
  ) {}

  @Get('chapters')
  async getChapters(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.scriptService.getChapters(session.user.id);
  }

  @Get('episodes/:id')
  async getEpisode(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.scriptService.getEpisodeDetail(id, session.user.id);
  }

  @Get('episodes/:id/readiness')
  async getReadiness(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.scriptService.getEpisodeReadiness(id, session.user.id);
  }

  @Get('episodes/:id/ink')
  async getInk(@Param('id') id: string) {
    return this.scriptService.getInkScript(id);
  }

  @Post('episodes/:id/judge')
  async judgeDialogue(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: {
      lastNpcText: string;
      userTranscript: string;
      completedObjectives: string[];
      usedChunks: string[];
      round: number;
      maxRounds: number;
    },
  ) {
    const session = await requireAuthSession(req);
    // Save the dialogue round
    await this.scriptService.saveDialogue(session.user.id, id, {
      npcText: body.lastNpcText,
      userText: body.userTranscript,
      round: body.round,
    });

    // Build prompt & return judge instructions
    const episode = await this.scriptService.getEpisodeForJudge(id);
    return this.judgeService.buildJudgePrompt({
      sceneTitle: episode.scene?.title ?? '',
      npcName: episode.npcName,
      npcRole: episode.npcRole,
      npcPersonality: episode.npcPersonality ?? undefined,
      objectives: episode.objectives as string[],
      coreChunks: episode.coreChunks?.map((c: any) => c.chunk?.text ?? c.chunkId) ?? [],
      lastNpcText: body.lastNpcText,
      userTranscript: body.userTranscript,
      completedObjectives: body.completedObjectives,
      usedChunks: body.usedChunks,
      round: body.round,
      maxRounds: body.maxRounds,
    });
  }

  @Post('episodes/:id/retell')
  async submitRetell(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { userTranscript: string; targetText: string },
  ) {
    const session = await requireAuthSession(req);
    return this.scriptService.submitRetell(session.user.id, id, body);
  }

  @Post('episodes/:id/complete')
  async completeEpisode(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const session = await requireAuthSession(req);
    return this.scriptService.completeEpisode(session.user.id, id, body);
  }

  @Get('records')
  async getRecords(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.scriptService.getRecords(session.user.id);
  }
}
