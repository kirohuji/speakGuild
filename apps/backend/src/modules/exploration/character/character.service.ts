import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCharacters() {
    return this.prisma.gameCharacter.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async getCharacterDetail(characterId: string) {
    return this.prisma.gameCharacter.findUnique({
      where: { id: characterId },
      include: {
        locationNpcs: {
          include: { location: { select: { id: true, name: true, displayName: true } } },
        },
      },
    });
  }
}
