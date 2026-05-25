import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    let status = await this.prisma.onboardingStatus.findUnique({
      where: { userId },
    });
    if (!status) {
      status = await this.prisma.onboardingStatus.create({
        data: { userId },
      });
    }
    return status;
  }

  async selectGoals(userId: string, goals: string[]) {
    // Update user's learning goals
    await this.prisma.user.update({
      where: { id: userId },
      data: { learningGoals: goals },
    });

    return this.prisma.onboardingStatus.upsert({
      where: { userId },
      create: { userId, goalsSelected: true },
      update: { goalsSelected: true },
    });
  }

  async selectAbility(userId: string, outputLevel: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { outputLevel },
    });

    return this.prisma.onboardingStatus.upsert({
      where: { userId },
      create: { userId, abilitySelected: true },
      update: { abilitySelected: true },
    });
  }

  async submitDiagnostic(userId: string, result: any) {
    // Save diagnostic result and update output level
    if (result.outputLevel) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          outputLevel: result.outputLevel,
          outputLevelDetail: result.dimensions ?? result,
        },
      });
    }

    return this.prisma.onboardingStatus.upsert({
      where: { userId },
      create: {
        userId,
        diagnosticDone: true,
        diagnosticResult: result,
      },
      update: {
        diagnosticDone: true,
        diagnosticResult: result,
      },
    });
  }
}
