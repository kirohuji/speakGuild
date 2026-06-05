import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';

export class ChunkExampleDto {
  @IsString()
  en: string;

  @IsString()
  zh: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  level?: string;
}

export class CreateChunkDto {
  @IsString()
  text: string;

  @IsString()
  meaning: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  examples?: ChunkExampleDto[];
}

export class UpdateChunkDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  meaning?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  examples?: ChunkExampleDto[];
}

export class CreateScriptEpisodeDto {
  @IsString()
  chapterId: string;

  @IsString()
  chapterTitle: string;

  @IsInt()
  episodeOrder: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  sceneId: string;

  @IsOptional()
  @IsString()
  requiredOutputLevel?: string;

  @IsOptional()
  @IsInt()
  requiredUserLevel?: number;

  @IsOptional()
  @IsInt()
  vocabRequiredCount?: number;

  @IsOptional()
  @IsInt()
  vocabTotalCount?: number;

  @IsOptional()
  @IsInt()
  chunkRequiredCount?: number;

  @IsOptional()
  @IsInt()
  chunkTotalCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteEpisodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsInt()
  passObjectiveCount?: number;

  @IsOptional()
  @IsInt()
  passChunkCount?: number;

  @IsOptional()
  passRetellRequired?: boolean;

  @IsOptional()
  @IsInt()
  passMinDialogues?: number;

  @IsOptional()
  rewards?: any;

  @IsOptional()
  @IsString()
  npcName?: string;

  @IsOptional()
  @IsString()
  npcRole?: string;

  @IsOptional()
  @IsString()
  npcPersonality?: string;

  @IsOptional()
  @IsString()
  inkScriptId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vocabIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  isPreview?: boolean;
}

export class UpdateScriptEpisodeDto {
  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  chapterTitle?: string;

  @IsOptional()
  @IsInt()
  episodeOrder?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sceneId?: string;

  @IsOptional()
  @IsString()
  requiredOutputLevel?: string;

  @IsOptional()
  @IsInt()
  requiredUserLevel?: number;

  @IsOptional()
  @IsInt()
  vocabRequiredCount?: number;

  @IsOptional()
  @IsInt()
  vocabTotalCount?: number;

  @IsOptional()
  @IsInt()
  chunkRequiredCount?: number;

  @IsOptional()
  @IsInt()
  chunkTotalCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteEpisodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsInt()
  passObjectiveCount?: number;

  @IsOptional()
  @IsInt()
  passChunkCount?: number;

  @IsOptional()
  passRetellRequired?: boolean;

  @IsOptional()
  @IsInt()
  passMinDialogues?: number;

  @IsOptional()
  rewards?: any;

  @IsOptional()
  @IsString()
  npcName?: string;

  @IsOptional()
  @IsString()
  npcRole?: string;

  @IsOptional()
  @IsString()
  npcPersonality?: string;

  @IsOptional()
  @IsString()
  inkScriptId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vocabIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  isPreview?: boolean;
}

export class CreateAchievementDefDto {
  @IsString()
  key: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  condition?: any;

  @IsOptional()
  @IsInt()
  rewardXp?: number;

  @IsOptional()
  @IsString()
  rewardTitle?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  isHidden?: boolean;

  @IsOptional()
  @IsString()
  hintText?: string;
}

export class UpdateAchievementDefDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  condition?: any;

  @IsOptional()
  @IsInt()
  rewardXp?: number;

  @IsOptional()
  @IsString()
  rewardTitle?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  isHidden?: boolean;

  @IsOptional()
  @IsString()
  hintText?: string;
}
