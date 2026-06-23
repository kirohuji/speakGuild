import { get, post, patch, del as _delete } from '@/lib/request'

export interface PreviewDialogueTurnResult {
  intent: string
  passed: boolean
  objectiveCompleted: string[]
  chunksUsed: string[]
  inkVariables: Record<string, string | number | boolean>
  feedback: string
  confidence: number
  raw?: string
}

export async function judgePreviewDialogueTurn(data: {
  topicId: string
  inputNodeId?: string
  npcText: string
  userText: string
  objectives?: string[]
  targetChunks?: string[]
}): Promise<PreviewDialogueTurnResult> {
  return post('/admin/content/preview/dialogue-turn', data)
}

// ─── Scene Categories ───────────────────────────────────────

export interface SceneCategory {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  _count?: { scenes: number }
}

export async function listSceneCategories(packageType?: Scene['packageType']): Promise<SceneCategory[]> {
  return get('/admin/content/scene-categories', packageType ? { packageType } : undefined)
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
  packageType: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
  title: string
  location: string
  description: string | null
  requiredOutputLevel: string
  requiredUserLevel: number
  category?: { id: string; name: string }
  _count?: { trainingTopics: number; storyEpisodes?: number }
  trainingTopics?: TrainingTopic[]
}

export async function listScenes(categoryId?: string, packageType?: Scene['packageType']): Promise<Scene[]> {
  const params: Record<string, string> = {}
  if (categoryId) params.categoryId = categoryId
  if (packageType) params.packageType = packageType
  return get('/admin/content/scenes', Object.keys(params).length ? params : undefined)
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

export interface Vocabulary {
  id: string
  word: string
  meaning: string
  description?: string | null
  sortOrder: number
}

export async function listVocabularies(): Promise<Vocabulary[]> {
  return get('/admin/content/vocabularies')
}

export async function createVocabulary(data: Partial<Vocabulary>): Promise<Vocabulary> {
  return post('/admin/content/vocabularies', data)
}

export async function updateVocabulary(id: string, data: Partial<Vocabulary>): Promise<Vocabulary> {
  return patch(`/admin/content/vocabularies/${id}`, data)
}

export async function deleteVocabulary(id: string): Promise<void> {
  return _delete(`/admin/content/vocabularies/${id}`)
}

// ─── Training Topics ─────────────────────────────────────────

export interface TrainingTopic {
  id: string
  sceneId: string
  type?: 'daily' | 'ielts'
  title: string
  description?: string | null
  teachingMarkdown?: string | null
  promptEn: string
  promptZh: string
  suggestedDurationSec: number
  difficulty: string
  metadata?: any
  sentencePatterns: SentencePattern[]  // still sent as sentencePatterns from API for compat
  inkScriptId?: string | null
  sortOrder: number
  scene?: { id: string; title: string; packageType?: string }
  activeChunks?: { id: string; chunk: { id: string; text: string } }[]
  topicPatterns?: { id: string; pattern: SentencePattern; sortOrder: number }[]
  topicVocabs?: { id: string; vocab: Vocabulary; sortOrder: number }[]
}

export async function listTrainingTopics(sceneId?: string): Promise<TrainingTopic[]> {
  return get('/admin/content/training-topics', sceneId ? { sceneId } : undefined)
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

export async function getTrainingTopic(id: string): Promise<TrainingTopic> {
  return get(`/admin/content/training-topics/${id}`)
}

// ─── Chunks ──────────────────────────────────────────────────

export interface Chunk {
  id: string
  text: string
  meaning: string
  description?: string | null
  category: string | null
  difficulty: string
  examples?: ChunkExample[]
  _count?: { userProgresses: number }
}

export interface ChunkExample {
  id?: string
  en: string
  zh: string
  note?: string | null
  level?: string
  sceneId?: string | null
  sortOrder?: number
}

export interface SentencePattern {
  pattern: string
  meaning: string
  slots: string[]
  example: string
  difficulty: string
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

export interface StoryEpisode {
  id: string
  chapterId: string
  chapterTitle: string
  episodeOrder: number
  title: string
  description?: string | null
  backgroundUrl?: string | null
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
  coreChunks?: { id: string; chunkId?: string; chunk?: Chunk }[]
  coreVocabularies?: { id: string; vocabId?: string; vocab?: Vocabulary }[]
  _count?: { records: number; dialogues: number }
}

export async function listScriptEpisodes(sceneId?: string): Promise<StoryEpisode[]> {
  return get('/admin/content/script-episodes', sceneId ? { sceneId } : undefined)
}

export async function getScriptEpisode(id: string): Promise<StoryEpisode> {
  return get(`/admin/content/script-episodes/${id}`)
}

export async function createScriptEpisode(data: any): Promise<StoryEpisode> {
  return post('/admin/content/script-episodes', data)
}

export async function updateScriptEpisode(id: string, data: any): Promise<StoryEpisode> {
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

// ─── Game Characters (角色管理) ───────────────────────────────

export interface GameCharacter {
  id: string
  name: string
  displayName: string
  role: string
  personality?: string | null
  avatarUrl?: string | null
  spriteBaseUrl?: string | null
  expressions?: any
  defaultPosition?: string | null
  ttsVoice?: string | null
  ttsModel?: string | null
  ttsParams?: Record<string, number> | null
  roomNpcs?: { room: { id: string; displayName: string; location: { id: string; displayName: string } } }[]
}

export async function listCharacters(): Promise<GameCharacter[]> {
  return get('/admin/content/characters')
}

export async function createCharacter(data: Partial<GameCharacter>): Promise<GameCharacter> {
  return post('/admin/content/characters', data)
}

export async function updateCharacter(id: string, data: Partial<GameCharacter>): Promise<GameCharacter> {
  return patch(`/admin/content/characters/${id}`, data)
}

export async function deleteCharacter(id: string): Promise<void> {
  return _delete(`/admin/content/characters/${id}`)
}

// ─── Game Maps (地图管理) ─────────────────────────────────────

export interface GameMapData {
  id: string
  name: string
  displayName: string
  backgroundUrl?: string | null
  thumbnailUrl?: string | null
  icon?: string | null
  requiredOutputLevel: string
  requiredChapterId?: string | null
  disabled: boolean
  hidden: boolean
  isPreview: boolean
  sortOrder: number
  locations?: GameLocationData[]
}

export interface GameLocationData {
  id: string
  mapId: string
  name: string
  displayName: string
  description?: string | null
  posX: number
  posY: number
  icon?: string | null
  backgroundUrl?: string | null
  locationType: string
  sceneId?: string | null
  requiredOutputLevel: string
  disabled: boolean
  hidden: boolean
  isPreview: boolean
  sortOrder: number
  map?: { id: string; displayName: string }
  rooms?: GameRoomData[]
}

export interface GameRoomData {
  id: string
  locationId: string
  name: string
  displayName: string
  description?: string | null
  backgroundUrl?: string | null
  inkScriptId?: string | null
  icon?: string | null
  roomType: string
  isEntrance: boolean
  disabled: boolean
  hidden: boolean
  requiredOutputLevel: string
  isPreview: boolean
  sortOrder: number
  location?: { id: string; displayName: string; map?: { id: string; displayName: string } }
  npcs?: { id: string; character: GameCharacter; sortOrder: number }[]
}

export async function listMaps(): Promise<GameMapData[]> {
  return get('/admin/content/maps')
}

export async function createMap(data: Partial<GameMapData>): Promise<GameMapData> {
  return post('/admin/content/maps', data)
}

export async function updateMap(id: string, data: Partial<GameMapData>): Promise<GameMapData> {
  return patch(`/admin/content/maps/${id}`, data)
}

export async function deleteMap(id: string): Promise<void> {
  return _delete(`/admin/content/maps/${id}`)
}

export async function listLocations(mapId?: string): Promise<GameLocationData[]> {
  return get('/admin/content/locations', mapId ? { mapId } : undefined)
}

export async function createLocation(data: Partial<GameLocationData>): Promise<GameLocationData> {
  return post('/admin/content/locations', data)
}

export async function updateLocation(id: string, data: Partial<GameLocationData>): Promise<GameLocationData> {
  return patch(`/admin/content/locations/${id}`, data)
}

export async function deleteLocation(id: string): Promise<void> {
  return _delete(`/admin/content/locations/${id}`)
}

// ─── Game Rooms (房间管理 — NQTR Navigation: Map→Location→Room) ──

export async function listRooms(locationId?: string): Promise<GameRoomData[]> {
  return get('/admin/content/rooms', locationId ? { locationId } : undefined)
}

export async function createRoom(data: Partial<GameRoomData>): Promise<GameRoomData> {
  return post('/admin/content/rooms', data)
}

export async function updateRoom(id: string, data: Partial<GameRoomData>): Promise<GameRoomData> {
  return patch(`/admin/content/rooms/${id}`, data)
}

export async function deleteRoom(id: string): Promise<void> {
  return _delete(`/admin/content/rooms/${id}`)
}

// ─── Room NPCs ──────────────────────────────────────────────

export async function addRoomNpc(data: { roomId: string; characterId: string; sortOrder?: number }): Promise<any> {
  return post('/admin/content/room-npcs', data)
}

export async function removeRoomNpc(id: string): Promise<void> {
  return _delete(`/admin/content/room-npcs/${id}`)
}


// ─── Stories / Ink Scripts (故事管理) ──────────────────────────

export interface StoryData {
  id: string
  key: string
  title: string
  scriptType: string
  inkJson: any
  inkSource?: string | null
  episodeId?: string | null
  locationId?: string | null
  characterId?: string | null
  topicId?: string | null
  version: number
  createdAt: string
  updatedAt: string
  trainingTopic?: {
    id: string
    title: string
    teachingMarkdown?: string | null
    scene?: {
      id: string
      title: string
      packageType?: string
      category?: { id: string; name: string } | null
    } | null
  } | null
  _count?: { trainingTopic: number }
}

export interface StoryListResponse {
  items: StoryData[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface StoryFilters {
  scriptTypes: string[]
  packageTypes: string[]
  categories: { id: string; name: string }[]
}

export async function listStories(params?: {
  search?: string
  scriptType?: string
  packageType?: string
  categoryId?: string
  page?: number
  pageSize?: number
}): Promise<StoryListResponse> {
  return get('/admin/content/stories', params)
}

export async function getStoryFilters(): Promise<StoryFilters> {
  return get('/admin/content/stories/filters')
}

export async function getStory(id: string): Promise<StoryData> {
  return get(`/admin/content/stories/${id}`)
}

export async function createStory(data: Partial<StoryData>): Promise<StoryData> {
  return post('/admin/content/stories', data)
}

export async function updateStory(id: string, data: Partial<StoryData>): Promise<StoryData> {
  return patch(`/admin/content/stories/${id}`, data)
}

export async function deleteStory(id: string): Promise<void> {
  return _delete(`/admin/content/stories/${id}`)
}

export async function deleteStoriesByScene(sceneId: string): Promise<{ success: boolean; count: number }> {
  return _delete(`/admin/content/stories/by-scene/${sceneId}`)
}

// ─── Story AI Tools ──────────────────────────────────────────

export interface AiGenerateStoryResult {
  inkSource: string
}

export async function aiGenerateStory(data: {
  topicId: string
  storyKey: string
  title: string
  goalPrompt?: string
  characterNames?: string[]
  characterPersonality?: string
  characterRole?: string
  characterDisplayName?: string
  locationName?: string
  locationBackgroundUrl?: string
}): Promise<AiGenerateStoryResult> {
  return post('/admin/content/stories/ai-generate', data)
}

export interface TranslateStoryResult {
  inkSource: string
  translatedCount: number
}

export async function translateStory(id: string): Promise<TranslateStoryResult> {
  return post(`/admin/content/stories/${id}/translate`)
}

export interface GenerateStoryAudioResult {
  inkSource: string
  generatedCount: number
  errorCount: number
  errors?: string[]
  skippedSpeakers?: string[]
}

export async function generateStoryAudio(id: string): Promise<GenerateStoryAudioResult> {
  return post(`/admin/content/stories/${id}/generate-audio`)
}

export interface GenerateTeachingMarkdownResult {
  markdown: string
}

export async function generateTeachingMarkdown(id: string): Promise<GenerateTeachingMarkdownResult> {
  return post(`/admin/content/stories/${id}/generate-teaching`)
}

// ═══ Content Library: Vocabulary, Chunk, Sentence Pattern ═══

export interface VocabularyFull {
  id: string; word: string; meaning: string; partOfSpeech?: string | null;
  phoneticUs?: string | null; phoneticUk?: string | null;
  audioUsUrl?: string | null; audioUkUrl?: string | null;
  definitionEn?: string | null; synonyms: string[];
  examples?: any; description?: string | null;
  difficulty: string; sortOrder: number;
}

export interface ChunkFull {
  id: string; text: string; meaning: string; description?: string | null;
  category: string; difficulty: string;
  examples: { id: string; en: string; zh: string; note?: string | null; level: string; sortOrder: number }[];
  createdAt: string;
}

export interface SentencePatternFull {
  id: string; pattern: string; meaning?: string | null;
  category?: string | null; description?: string | null;
  slots?: any; examples?: any; difficulty: string;
  createdAt: string; updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number;
}

// ─── Vocabulary ──────────────────────────────────────────────

export function listLibraryVocabularies(params?: {
  search?: string; difficulty?: string; page?: number; pageSize?: number
}): Promise<PaginatedResult<VocabularyFull>> {
  return get('/admin/content/library/vocabularies', params);
}
export function createLibraryVocabulary(data: Partial<VocabularyFull>): Promise<VocabularyFull> {
  return post('/admin/content/library/vocabularies', data);
}
export function updateLibraryVocabulary(id: string, data: Partial<VocabularyFull>): Promise<VocabularyFull> {
  return patch(`/admin/content/library/vocabularies/${id}`, data);
}
export function deleteLibraryVocabulary(id: string): Promise<void> {
  return _delete(`/admin/content/library/vocabularies/${id}`);
}
export function enrichVocabulary(id: string): Promise<VocabularyFull> {
  return post(`/admin/content/library/vocabularies/${id}/enrich`);
}

export interface AiEnrichResult {
  phoneticUs: string;
  phoneticUk: string;
  definitionTranslations: string[];
  generatedExamples: { en: string; zh: string; level: string }[];
  meaning: string;
  description: string;
}

export function aiEnrichVocabulary(data: {
  word: string;
  definitions: string[];
  examples: { en: string }[];
  phoneticUs?: string;
  phoneticUk?: string;
}): Promise<AiEnrichResult> {
  return post('/admin/content/library/vocabularies/ai-enrich', data);
}

// ─── Pattern AI Enrich ───────────────────────────────────────

export interface PatternAiEnrichResult {
  examples: { en: string; zh: string; level: string }[];
  description: string;
}

export function aiEnrichPattern(data: {
  pattern: string;
  meaning: string;
}): Promise<PatternAiEnrichResult> {
  return post('/admin/content/library/patterns/ai-enrich', data);
}

// ─── Chunk ───────────────────────────────────────────────────

export function listLibraryChunks(params?: {
  search?: string; difficulty?: string; page?: number; pageSize?: number
}): Promise<PaginatedResult<ChunkFull>> {
  return get('/admin/content/library/chunks', params);
}
export function createLibraryChunk(data: Partial<ChunkFull> & { examples?: any[] }): Promise<ChunkFull> {
  return post('/admin/content/library/chunks', data);
}
export function updateLibraryChunk(id: string, data: Partial<ChunkFull> & { examples?: any[] }): Promise<ChunkFull> {
  return patch(`/admin/content/library/chunks/${id}`, data);
}
export function deleteLibraryChunk(id: string): Promise<void> {
  return _delete(`/admin/content/library/chunks/${id}`);
}

// ─── Chunk AI Enrich ─────────────────────────────────────────

export interface ChunkAiEnrichResult {
  description: string;
  examples: { en: string; zh: string; level: string }[];
}

export function aiEnrichChunk(data: {
  text: string;
  meaning: string;
}): Promise<ChunkAiEnrichResult> {
  return post('/admin/content/library/chunks/ai-enrich', data);
}

/** 获取所有已有的句块分类 */
export function listChunkCategories(): Promise<string[]> {
  return get('/admin/content/library/chunks/categories');
}

// ─── Sentence Pattern ────────────────────────────────────────

export function listLibraryPatterns(params?: {
  search?: string; difficulty?: string; page?: number; pageSize?: number
}): Promise<PaginatedResult<SentencePatternFull>> {
  return get('/admin/content/library/patterns', params);
}
export function createLibraryPattern(data: Partial<SentencePatternFull>): Promise<SentencePatternFull> {
  return post('/admin/content/library/patterns', data);
}
export function updateLibraryPattern(id: string, data: Partial<SentencePatternFull>): Promise<SentencePatternFull> {
  return patch(`/admin/content/library/patterns/${id}`, data);
}
export function deleteLibraryPattern(id: string): Promise<void> {
  return _delete(`/admin/content/library/patterns/${id}`);
}

/** 获取所有已有的句式分类 */
export function listPatternCategories(): Promise<string[]> {
  return get('/admin/content/library/patterns/categories');
}
