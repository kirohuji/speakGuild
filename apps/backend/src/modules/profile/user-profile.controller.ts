import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { ProfileService } from './profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller('user')
export class UserProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.profileService.getUserProfile(session.user.id);
  }

  @Patch('profile')
  async updateProfile(@Req() req: Request, @Body() dto: UpdateUserProfileDto) {
    const session = await requireAuthSession(req);
    return this.profileService.updateUserProfile(session.user.id, dto);
  }
}
