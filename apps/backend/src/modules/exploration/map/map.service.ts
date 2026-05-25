import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllMaps(userId: string) {
    const maps = await this.prisma.gameMap.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        locations: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            displayName: true,
            posX: true,
            posY: true,
            icon: true,
            isPreview: true,
          },
        },
      },
    });

    // Attach unlock status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outputLevel: true },
    });

    return maps.map((map) => ({
      ...map,
      unlocked: user
        ? parseInt(user.outputLevel.replace('L', '')) >=
          parseInt(map.requiredOutputLevel.replace('L', ''))
        : map.isPreview,
    }));
  }

  async getMapDetail(mapId: string) {
    return this.prisma.gameMap.findUnique({
      where: { id: mapId },
      include: {
        locations: {
          orderBy: { sortOrder: 'asc' },
          include: {
            npcs: {
              include: { character: true },
              orderBy: { sortOrder: 'asc' },
            },
            exits: {
              include: { to: { select: { id: true, name: true, displayName: true } } },
            },
          },
        },
      },
    });
  }

  async getLocationDetail(locationId: string) {
    return this.prisma.gameLocation.findUnique({
      where: { id: locationId },
      include: {
        npcs: {
          include: { character: true },
          orderBy: { sortOrder: 'asc' },
        },
        exits: {
          include: { to: { select: { id: true, name: true, displayName: true } } },
        },
      },
    });
  }
}
