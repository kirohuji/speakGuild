import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** AI 通知写作场景 */
export enum NotificationAiScene {
  /** 版本更新 */
  VersionUpdate = 'versionUpdate',
  /** 学习包发布 */
  LearningPack = 'learningPack',
  /** 优惠活动 */
  Discount = 'discount',
  /** 系统维护 */
  Maintenance = 'maintenance',
  /** 节日问候 */
  Greeting = 'greeting',
  /** 自定义 */
  Custom = 'custom',
}

export class AiWriteNotificationDto {
  @IsEnum(NotificationAiScene)
  type: NotificationAiScene;

  /** 补充信息，如版本号、学习包名称、折扣力度等 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;

  /** 是否为特殊消息（首页横幅），特殊消息建议更精炼醒目 */
  @IsOptional()
  @IsBoolean()
  isSpecial?: boolean;
}
