import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class GameSaveService {
  constructor(private readonly prisma: PrismaService) {}

  async listSaves(userId: string) {
    return this.prisma.gameSave.findMany({
      where: { userId },
      orderBy: { slot: 'asc' },
      select: {
        slot: true,
        saveName: true,
        playTimeSeconds: true,
        currentMapId: true,
        currentLocationId: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }

  async getSave(userId: string, slot: number) {
    return this.prisma.gameSave.findUnique({
      where: { userId_slot: { userId, slot } },
    });
  }

  async saveGame(
    userId: string,
    slot: number,
    data: {
      inkState?: any;
      currentMapId?: string;
      currentLocationId?: string;
      visitedLocationIds?: string[];
      flags?: any;
      saveName?: string;
      playTimeSeconds?: number;
    },
  ) {
    return this.prisma.gameSave.upsert({
      where: { userId_slot: { userId, slot } },
      create: {
        userId,
        slot,
        ...data,
        saveName: data.saveName ?? `存档 ${slot}`,
      },
      update: data,
    });
  }

  async deleteSave(userId: string, slot: number) {
    return this.prisma.gameSave.deleteMany({
      where: { userId, slot },
    });
  }
}
