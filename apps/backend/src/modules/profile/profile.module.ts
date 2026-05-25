import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserProfileController } from './user-profile.controller';

@Module({
  controllers: [ProfileController, UserProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
