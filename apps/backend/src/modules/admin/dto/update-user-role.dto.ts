import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(['user', 'admin'], { message: '角色只能是 user 或 admin' })
  role: 'user' | 'admin';
}
