import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ExplorationService {
  constructor(private readonly prisma: PrismaService) {}

  async getLocationDetail(locationId: string) {
    return this.prisma.gameLocation.findUnique({
      where: { id: locationId },
      include: {
        map: {
          select: { id: true, name: true, displayName: true },
        },
        npcs: {
          include: { character: true },
          orderBy: { sortOrder: 'asc' },
        },
        exits: {
          include: {
            to: {
              select: { id: true, name: true, displayName: true, icon: true },
            },
          },
        },
      },
    });
  }

  async getDialogues(userId: string, characterId?: string) {
    return this.prisma.explorationRecord.findMany({
      where: {
        userId,
        ...(characterId ? { characterId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        character: { select: { id: true, name: true, displayName: true } },
        location: { select: { id: true, name: true, displayName: true } },
      },
    });
  }

  async createDialogue(userId: string, data: {
    characterId: string;
    locationId: string;
    userText: string;
    npcReply?: string;
    feedback?: any;
    isInkDriven?: boolean;
    inkKnotName?: string;
  }) {
    return this.prisma.explorationRecord.create({
      data: { userId, ...data },
    });
  }
}
