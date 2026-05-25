import { get, post, patch, del as _delete } from '@/lib/request'

// ─── Scene Categories ───────────────────────────────────────

export interface SceneCategory {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  _count?: { scenes: number }
}

export async function listSceneCategories(): Promise<SceneCategory[]> {
  return get('/admin/content/scene-categories')
}

export async function createSceneCategory(data: Partial<SceneCategory>): Promise<SceneCategory> {
  return post('/admin/content/scene-categories', data)
}

export async function updateSceneCategory(id: string, data: Partial<SceneCategory>): Promise<SceneCategory> {
  return patch(`/admin/content/scene-categories/${id}`, data)
}

export async function deleteSceneCategory(id: string): Promise<void> {
  return _delete(`/admin/content/scene-categories/${id}`)
}

// ─── Scenes ──────────────────────────────────────────────────

export interface Scene {
  id: string
  categoryId: string
  title: string
  location: string
  description: string | null
  requiredOutputLevel: string
  requiredUserLevel: number
  category?: { id: string; name: string }
  _count?: { vocabularies: number; chunks: number; trainingTopics: number }
  vocabularies?: SceneVocabulary[]
  chunks?: Chunk[]
  trainingTopics?: TrainingTopic[]
}

export async function listScenes(categoryId?: string): Promise<Scene[]> {
  return get('/admin/content/scenes', { params: categoryId ? { categoryId } : undefined })
}

export async function getScene(id: string): Promise<Scene> {
  return get(`/admin/content/scenes/${id}`)
}

export async function createScene(data: Partial<Scene>): Promise<Scene> {
  return post('/admin/content/scenes', data)
}

export async function updateScene(id: string, data: Partial<Scene>): Promise<Scene> {
  return patch(`/admin/content/scenes/${id}`, data)
}

export async function deleteScene(id: string): Promise<void> {
  return _delete(`/admin/content/scenes/${id}`)
}

// ─── Vocabulary ──────────────────────────────────────────────

export interface SceneVocabulary {
  id: string
  sceneId: string
  word: string
  meaning: string
  sortOrder: number
  scene?: { id: string; title: string }
}

export async function listVocabularies(sceneId?: string): Promise<SceneVocabulary[]> {
  return get('/admin/content/vocabularies', { params: sceneId ? { sceneId } : undefined })
}

export async function createVocabulary(data: Partial<SceneVocabulary>): Promise<SceneVocabulary> {
  return post('/admin/content/vocabularies', data)
}

export async function updateVocabulary(id: string, data: Partial<SceneVocabulary>): Promise<SceneVocabulary> {
  return patch(`/admin/content/vocabularies/${id}`, data)
}

export async function deleteVocabulary(id: string): Promise<void> {
  return _delete(`/admin/content/vocabularies/${id}`)
}

// ─── Training Topics ─────────────────────────────────────────

export interface TrainingTopic {
  id: string
  sceneId: string
  title: string
  promptEn: string
  promptZh: string
  suggestedDurationSec: number
  difficulty: string
  sentenceSkeleton: string | null
  sortOrder: number
  scene?: { id: string; title: string }
  activeChunks?: { id: string; chunk: { id: string; text: string } }[]
}

export async function listTrainingTopics(sceneId?: string): Promise<TrainingTopic[]> {
  return get('/admin/content/training-topics', { params: sceneId ? { sceneId } : undefined })
}

export async function createTrainingTopic(data: any): Promise<TrainingTopic> {
  return post('/admin/content/training-topics', data)
}

export async function updateTrainingTopic(id: string, data: any): Promise<TrainingTopic> {
  return patch(`/admin/content/training-topics/${id}`, data)
}

export async function deleteTrainingTopic(id: string): Promise<void> {
  return _delete(`/admin/content/training-topics/${id}`)
}

// ─── Chunks ──────────────────────────────────────────────────

export interface Chunk {
  id: string
  text: string
  meaning: string
  category: string | null
  difficulty: string
  example: string | null
  sceneId: string | null
  applicableSceneIds: string[]
  scene?: { id: string; title: string }
  _count?: { userProgresses: number }
}

export async function listAllChunks(): Promise<Chunk[]> {
  return get('/admin/content/chunks')
}

export async function createChunk(data: Partial<Chunk>): Promise<Chunk> {
  return post('/admin/content/chunks', data)
}

export async function updateChunk(id: string, data: Partial<Chunk>): Promise<Chunk> {
  return patch(`/admin/content/chunks/${id}`, data)
}

export async function deleteChunk(id: string): Promise<void> {
  return _delete(`/admin/content/chunks/${id}`)
}

// ─── Script Episodes ─────────────────────────────────────────

export interface ScriptEpisode {
  id: string
  chapterId: string
  chapterTitle: string
  episodeOrder: number
  title: string
  sceneId: string
  requiredOutputLevel: string
  requiredUserLevel: number
  vocabRequiredCount: number
  vocabTotalCount: number
  chunkRequiredCount: number
  chunkTotalCount: number
  prerequisiteEpisodes: string[]
  objectives: string[]
  passObjectiveCount: number
  passChunkCount: number
  passRetellRequired: boolean
  passMinDialogues: number
  rewards: any
  npcName: string
  npcRole: string
  npcPersonality: string | null
  inkScriptId: string | null
  isPreview: boolean
  scene?: { id: string; title: string }
  _count?: { records: number; dialogues: number }
}

export async function listScriptEpisodes(): Promise<ScriptEpisode[]> {
  return get('/admin/content/script-episodes')
}

export async function getScriptEpisode(id: string): Promise<ScriptEpisode> {
  return get(`/admin/content/script-episodes/${id}`)
}

export async function createScriptEpisode(data: any): Promise<ScriptEpisode> {
  return post('/admin/content/script-episodes', data)
}

export async function updateScriptEpisode(id: string, data: any): Promise<ScriptEpisode> {
  return patch(`/admin/content/script-episodes/${id}`, data)
}

export async function deleteScriptEpisode(id: string): Promise<void> {
  return _delete(`/admin/content/script-episodes/${id}`)
}

// ─── Achievement Definitions ─────────────────────────────────

export interface AchievementDef {
  id: string
  key: string
  title: string
  description: string
  category: string
  rarity: string
  icon: string | null
  condition: any
  rewardXp: number
  rewardTitle: string | null
  sortOrder: number
  isHidden: boolean
  hintText: string | null
  _count?: { userAchievements: number }
}

export async function listAchievementDefs(): Promise<AchievementDef[]> {
  return get('/admin/content/achievements')
}

export async function createAchievementDef(data: any): Promise<AchievementDef> {
  return post('/admin/content/achievements', data)
}

export async function updateAchievementDef(id: string, data: any): Promise<AchievementDef> {
  return patch(`/admin/content/achievements/${id}`, data)
}

export async function deleteAchievementDef(id: string): Promise<void> {
  return _delete(`/admin/content/achievements/${id}`)
}
