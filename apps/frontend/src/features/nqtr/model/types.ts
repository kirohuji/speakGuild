import type { NqtrChrome, NqtrTimeSettings, QuestProgress } from './nqtr-time-chrome'

export type NqtrTalk = {
  token: string
  roomId: string
  scriptId: string
  label: string
  spend: number
  questId: string | null
  questAction: 'start' | 'continue' | null
  metKey?: string
}

export type NqtrPlace =
  | { mode: 'map' }
  | { mode: 'location'; locationId: string }
  | { mode: 'room'; roomId: string }
  | { mode: 'talk'; roomId: string; talk: NqtrTalk }

export type NqtrSession = {
  gameDay: number
  gameTime: number
  attached: { activityId: string; roomId: string }[]
  enabledCommitmentIds: string[]
  questProgress: QuestProgress
  flags: Record<string, string | number | boolean>
  applied: string[]
  log: string[]
}

export type NqtrCharacter = {
  id: string
  name?: string
  displayName: string
  avatarUrl?: string | null
  spriteBaseUrl?: string | null
  /** 角色库存的是 name→sprite 映射；旧数据也可能是数组。 */
  expressions?: Record<string, string | { spriteUrl?: string; avatarUrl?: string }> | Array<{ spriteUrl?: string } | Record<string, unknown>> | null
}

export type NqtrMap = {
  id: string
  displayName: string
  backgroundUrl?: string | null
  editorData?: any
}

export type NqtrLocation = {
  id: string
  mapId: string
  displayName: string
  posX: number
  posY: number
  icon?: string | null
  backgroundUrl?: string | null
  hidden?: boolean
  disabled?: boolean
}

export type NqtrRoom = {
  id: string
  locationId: string
  displayName: string
  backgroundUrl?: string | null
  icon?: string | null
  isEntrance?: boolean
  hidden?: boolean
  disabled?: boolean
  inkScriptId?: string | null
}

export type NqtrActivity = {
  id: string
  key: string
  title: string
  minutes: number
  startMinute?: number | null
  endMinute?: number | null
  timeFrom?: number | null
  timeTo?: number | null
  trigger: 'click' | 'auto'
  inkScriptId?: string | null
  iconUrl?: string | null
  availableFromDate?: number | null
  availableUntilDate?: number | null
  questId?: string | null
  questAction?: 'start' | 'continue' | null
  roomLinks?: { roomId: string }[]
}

export type NqtrCommitment = {
  id: string
  key: string
  characterId: string
  roomId: string
  startMinute: number
  endMinute: number
  timeFrom?: number | null
  timeTo?: number | null
  priority: number
  trigger: 'click' | 'auto'
  inkScriptId?: string | null
  imageUrl?: string | null
  slotImages?: Record<string, string> | null
  questId?: string | null
  questAction?: 'start' | 'continue' | null
}

export type NqtrQuestStageAction = {
  id?: string
  sortOrder?: number
  kind: 'add_activity' | 'add_commitment'
  phase?: 'on_start' | 'on_continue'
  activityId?: string | null
  commitmentId?: string | null
  roomId?: string | null
}

export type NqtrQuestStage = {
  id?: string
  stageKey: string
  title: string
  description?: string | null
  sortOrder?: number
  deltaDays?: number | null
  startNote?: string | null
  requiredFlags?: Record<string, string | number | boolean> | null
  actions?: NqtrQuestStageAction[]
}

export type NqtrQuest = {
  id: string
  key: string
  title: string
  summary?: string | null
  imageUrl?: string | null
  stages: NqtrQuestStage[]
}

export type NqtrChapterSummary = {
  id: string
  title: string
  summary?: string | null
  sortOrder?: number
  characterIds?: string[]
  locationIds?: string[]
}

export type NqtrWorldBundle = {
  map: NqtrMap | null
  locations: NqtrLocation[]
  rooms: NqtrRoom[]
  activities: NqtrActivity[]
  commitments: NqtrCommitment[]
  quests: NqtrQuest[]
  characters: NqtrCharacter[]
  time: NqtrTimeSettings
  chrome: NqtrChrome
  chapterId?: string
  chapters?: NqtrChapterSummary[]
}

export type NqtrStoryPayload = {
  inkJson?: Record<string, unknown> | null
  inkSource?: string | null
  assetMap?: Record<string, { fileAssetId?: string; signedUrl?: string | null } | string> | null
}

export type NqtrDialogueRenderProps = {
  token: string
  inkJson?: Record<string, unknown>
  inkSource?: string
  assetMap?: Record<string, { fileAssetId?: string; signedUrl?: string | null }> | null
  characters: NqtrCharacter[]
  defaultBackgroundUrl?: string
  onDismiss: () => void
  onDebugChange?: (state: NqtrDialogueDebug) => void
  onHistoryOpenChange?: (open: boolean) => void
}

export type NqtrDialogueDebug = {
  isReady: boolean
  isWaiting: boolean
  isEnded: boolean
  currentTags: string[]
  history: { speaker: string; text: string }[]
  choices: { index: number; text: string }[]
  activeBackground?: { url?: string; fit?: string }
  aiPayload?: Record<string, unknown>
}

export type NqtrSave = {
  id: string
  sceneId: string | null
  chapterId: string | null
  slot: number
  gameDay: number
  gameTime: number
  currentMapId: string | null
  currentLocationId: string | null
  currentRoomId: string | null
  visitedRoomIds: string[]
  flags: Record<string, string | number | boolean> | null
  questProgress: QuestProgress | null
  inkState: unknown
  runtime: {
    enabledCommitmentIds?: string[]
    attached?: { activityId: string; roomId: string }[]
    applied?: string[]
    metCommitmentKeys?: string[]
  } | null
}

export type NqtrSaveWrite = Omit<NqtrSave, 'id'> & { sceneId: string }
