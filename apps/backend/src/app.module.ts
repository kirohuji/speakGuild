import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { PracticeModule } from './modules/practice/practice.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ProfileModule } from './modules/profile/profile.module';
import { MembershipModule } from './modules/membership/membership.module';
import { TtsModule } from './modules/tts/tts.module';
import { PracticeAiModule } from './modules/practice-ai/practice-ai.module';
import { FileAssetsModule } from './modules/file-assets/file-assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { PayModule } from './modules/pay/pay.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { ReferralModule } from './modules/referral/referral.module';
import { AchievementModule } from './modules/achievement/achievement.module';
// --- English Output Training ---
import { SceneModule } from './modules/scene/scene.module';
import { ChunkModule } from './modules/chunk/chunk.module';
import { ScriptModule } from './modules/script/script.module';
import { ExpressionModule } from './modules/expression/expression.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ExplorationModule } from './modules/exploration/exploration.module';
import { LearningModule } from './modules/learning/learning.module';
import { PointsModule } from './modules/points/points.module';
import { AiQuotaModule } from './common/ai-quota/ai-quota.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PracticeModule,
    AssetsModule,
    ProfileModule,
    MembershipModule,
    TtsModule,
    PracticeAiModule,
    FileAssetsModule,
    AuthModule,
    AdminModule,
    PayModule,
    NotificationModule,
    FeedbackModule,
    LeaderboardModule,
    ReferralModule,
    AchievementModule,
    // --- English Output Training ---
    SceneModule,
    ChunkModule,
    ScriptModule,
    ExpressionModule,
    OnboardingModule,
    ExplorationModule,
    LearningModule,
    PointsModule,
    AiQuotaModule,
  ],
})
export class AppModule {}
