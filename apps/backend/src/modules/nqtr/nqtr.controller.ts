import { BadRequestException, Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireAuthSession } from '../auth/session.util';

type FlagValue = boolean | number | string;

export type NqtrSaveBody = {
  sceneId: string;
  chapterId?: string | null;
  slot?: number;
  gameDay?: number;
  gameTime?: number;
  currentMapId?: string | null;
  currentLocationId?: string | null;
  currentRoomId?: string | null;
  visitedRoomIds?: string[];
  flags?: Record<string, FlagValue>;
  questProgress?: Record<string, { stageKey: string; status: string; startedOnDay?: number }>;
  inkState?: unknown;
  runtime?: {
    enabledCommitmentIds?: string[];
    attached?: { activityId: string; roomId: string }[];
    applied?: string[];
    metCommitmentKeys?: string[];
  };
};

function cleanFlags(input: unknown): Record<string, FlagValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const flags: Record<string, FlagValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') flags[key] = value;
  }
  return flags;
}

@Controller('nqtr')
export class NqtrController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('chapters')
  async chapters(@Req() req: Request, @Query('sceneId') sceneId?: string) {
    await requireAuthSession(req);
    if (!sceneId) throw new BadRequestException('缺少剧情包');
    return this.prisma.nqtrChapter.findMany({
      where: { sceneId },
      orderBy: { sortOrder: 'asc' },
      include: {
        characters: { select: { characterId: true } },
        locations: { select: { locationId: true } },
      },
    });
  }

  @Get('saves')
  async readSave(@Req() req: Request, @Query('sceneId') sceneId?: string, @Query('slot') slot = '1') {
    const session = await requireAuthSession(req);
    if (!sceneId) throw new BadRequestException('缺少剧情包');
    return this.prisma.gameSave.findUnique({
      where: { userId_sceneId_slot: { userId: session.user.id, sceneId, slot: Number(slot) || 1 } },
    });
  }

  @Put('saves')
  async writeSave(@Req() req: Request, @Body() body: NqtrSaveBody) {
    const session = await requireAuthSession(req);
    if (!body?.sceneId) throw new BadRequestException('缺少剧情包');
    const slot = Number(body.slot) || 1;
    const data = {
      userId: session.user.id,
      sceneId: body.sceneId,
      chapterId: body.chapterId || null,
      slot,
      gameDay: Number(body.gameDay) || 1,
      gameTime: Number(body.gameTime) || 8,
      currentMapId: body.currentMapId || null,
      currentLocationId: body.currentLocationId || null,
      currentRoomId: body.currentRoomId || null,
      visitedRoomIds: Array.isArray(body.visitedRoomIds) ? body.visitedRoomIds.filter(Boolean) : [],
      flags: cleanFlags(body.flags) as Prisma.InputJsonValue,
      questProgress: (body.questProgress ?? {}) as Prisma.InputJsonValue,
      inkState: body.inkState == null ? Prisma.JsonNull : (body.inkState as Prisma.InputJsonValue),
      runtime: (body.runtime ?? {}) as Prisma.InputJsonValue,
    };
    return this.prisma.gameSave.upsert({
      where: { userId_sceneId_slot: { userId: session.user.id, sceneId: body.sceneId, slot } },
      create: data,
      update: data,
    });
  }
}
