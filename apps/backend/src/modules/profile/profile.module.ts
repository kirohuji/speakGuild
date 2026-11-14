import { LearningStatisticsModule } from '../../common/learning-statistics/learning-statistics.module';
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserProfileController } from './user-profile.controller';

@Module({
  imports: [LearningStatisticsModule],
  controllers: [ProfileController, UserProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
