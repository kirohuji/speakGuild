import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(6, { message: '验证码为6位' })
  @MaxLength(6, { message: '验证码为6位' })
  otp!: string;

  @IsString()
  @MinLength(8, { message: '密码至少需要8位字符' })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: '请输入当前密码' })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: '新密码至少需要8位字符' })
  newPassword!: string;
}

export class DeleteAccountDto {
  @IsString()
  password!: string;
}
