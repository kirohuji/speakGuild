import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CompleteScriptPracticeDto {
  @IsIn(['vn', 'repeat'])
  mode!: 'vn' | 'repeat'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  turnCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  lineCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  usedChunkCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  completedObjectiveCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number

  @IsOptional()
  resultSnapshot?: Record<string, unknown>

  @IsOptional()
  @IsString()
  audioAssetId?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  recordingAssetIds?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recordingBatchId?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMutationId?: string
}

export class CreateScriptWorkDto {
  @IsString()
  recordId!: string

  @IsIn(['vn_video', 'repeat_video', 'progress_card'])
  kind!: 'vn_video' | 'repeat_video' | 'progress_card'

  @IsString()
  @MaxLength(80)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string

  @IsOptional()
  @IsString()
  coverAssetId?: string
}

export class UpdateScriptWorkDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string

  @IsOptional()
  @IsString()
  coverAssetId?: string
}

export class RenderScriptWorkDto {
  @IsArray()
  @ArrayMaxSize(2000)
  frames!: Record<string, unknown>[]
}

export class ScriptReactionDto {
  @IsIn([
    // zh-CN
    '绝了🔥',
    '有点东西😎',
    '🥹好可爱',
    '王者发言👑',
    '太牛了💥',
    '✨听得起鸡皮疙瘩',
    '被你萌到🐱',
    '🖤酷到没朋友',
    '今天的神🌟',
    '温柔🫶杀我',
    '直接封神🚀',
    '这💎质感绝了',
    // en
    'Insane🔥',
    'Kinda elite😎',
    '🥹So cute',
    'Main character👑',
    'Absolute beast💥',
    '✨Gave me chills',
    'Adorably soft🐱',
    '🖤Cool as hell',
    'Today\'s MVP🌟',
    'Soft🫶but lethal',
    'Instant legend🚀',
    'That💎texture though',
    // ja
    'やばい🔥',
    'なんか強い😎',
    '🥹かわいい',
    '主人公感👑',
    '天才かよ💥',
    '✨鳥肌きた',
    '萌え死🐱',
    '🖤クールすぎ',
    '今日の神🌟',
    '優しさ🫶で刺さる',
    '即レジェンド🚀',
    'この💎質感えぐい',
    // legacy (still stored on older works)
    '绝了 🔥',
    '有点东西 😎',
    '好可爱 🥹',
    '王者发言 👑',
    '太牛了 💥',
    '听得起鸡皮疙瘩 ✨',
    '被你萌到 🐱',
    '酷到没朋友 🖤',
    '今天的神 🌟',
    '温柔杀我 🫶',
    '直接封神 🚀',
    '这质感绝了 💎',
    'Insane 🔥',
    'Kinda elite 😎',
    'So cute 🥹',
    'Main character 👑',
    'Absolute beast 💥',
    'Gave me chills ✨',
    'Adorably soft 🐱',
    'Cool as hell 🖤',
    'Today\'s MVP 🌟',
    'Soft but lethal 🫶',
    'Instant legend 🚀',
    'That texture though 💎',
    'やばい 🔥',
    'なんか強い 😎',
    'かわいい 🥹',
    '主人公感 👑',
    '天才かよ 💥',
    '鳥肌きた ✨',
    '萌え死 🐱',
    'クールすぎ 🖤',
    '今日の神 🌟',
    '優しさで刺さる 🫶',
    '即レジェンド 🚀',
    '質感えぐい 💎',
    '🔥 绝了',
    '😎 有点东西',
    '🥹 好可爱',
    '👑 王者发言',
    '💥 太牛了',
    '✨ 听得起鸡皮疙瘩',
    '🐱 被你萌到',
    '🖤 酷到没朋友',
    '🌟 今天的神',
    '🫶 温柔杀我',
    '🚀 直接封神',
    '💎 这质感绝了',
    '🔥 Insane',
    '😎 Kinda elite',
    '🥹 So cute',
    '👑 Main character',
    '💥 Absolute beast',
    '✨ Gave me chills',
    '🐱 Adorably soft',
    '🖤 Cool as hell',
    '🌟 Today\'s MVP',
    '🫶 Soft but lethal',
    '🚀 Instant legend',
    '💎 That texture though',
    '🔥 やばい',
    '😎 なんか強い',
    '🥹 かわいい',
    '👑 主人公感',
    '💥 天才かよ',
    '✨ 鳥肌きた',
    '🐱 萌え死',
    '🖤 クールすぎ',
    '🌟 今日の神',
    '🫶 優しさで刺さる',
    '🚀 即レジェンド',
    '💎 質感えぐい',

    '🤩 也太会了吧',
    '🎤 发音超自然',
    '🎭 情绪拉满了',
    '🐣 同款练习中',
    '🔥 循环听三遍',
    '🧠 这句记住了',
    '🫶 勇气满分',
    '😂 笑出声了',
    '🌧️ 听哭预警',
    '🌀 语速绝了',
    '💬 偷偷抄走了',
    '🍵 松弛感好强',
    '🎤 发音拿捏了',
    '🎭 戏精附体',
    '🐣 同款选手报到',
    '🔥 再来亿遍',
    '✨ 学废我了',
    '🥰 听得我上头',
    '👏 这波稳了',
    '🌟 氛围感绝了',
    '🐱 直接宠了',
    '💬 这句我要抄',
    '🎯 精准拿捏',
    '🤩 Peak delivery',
    '🎤 Sounds so natural',
    '🎭 Emotion on point',
    '🐣 Practicing the same',
    '🔥 On loop already',
    '🧠 Saving that line',
    '🫶 Brave post energy',
    '😂 Made me laugh out loud',
    '🌧️ Unexpectedly moving',
    '🌀 Flow is unreal',
    '💬 Stealing this ASAP',
    '🍵 So chill and clean',
    '🤩 So good!',
    '🎤 Nailed the vibe',
    '🎭 Main character energy',
    '🐣 Same practice squad',
    '🔥 One more round!',
    '✨ Brain go brrr',
    '🥰 Instant mood boost',
    '👏 Clean take!',
    '🌟 Atmosphere unlocked',
    '🐱 Soft locked',
    '💬 Stealing that line',
    '🎯 Locked in',
    '🤩 天才すぎ',
    '🎤 発音が自然',
    '🎭 感情が刺さる',
    '🐣 同じの練習中',
    '🔥 リピート確定',
    '🧠 この文覚える',
    '🫶 投稿えらい',
    '😂 声出して笑った',
    '🌧️ なんか泣きそう',
    '🌀 テンポ神',
    '💬 セリフもらった',
    '🍵 ゆるくて上手',
    '🎤 発音きもちいい',
    '🎭 役者オーラ',
    '🔥 もう一回！',
    '✨ 学んじゃった',
    '🥰 聴いてて幸せ',
    '👏 完璧すぎ',
    '🌟 雰囲気やばい',
    '🐱 沼った',
    '💬 このセリフもらう',
    '🎯 刺さった',
    '太棒了',
    '发音真自然',
    '剧情感拉满',
    '我也在练',
    '继续加油',
    '学到了',
  ])
  reaction!: string
}

export class ScriptReportDto {
  @IsIn(['inappropriate', 'copyright', 'privacy', 'spam', 'other'])
  reason!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string
}
