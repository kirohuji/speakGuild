import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(['user', 'creator', 'admin'], { message: '角色只能是 user、creator 或 admin' })
  role: 'user' | 'creator' | 'admin';
}
