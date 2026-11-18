import type { MediaSessionAction } from '@capgo/capacitor-media-session'
import type { PlaybackStateEvent } from '@capgo/capacitor-native-audio'
import type { PlaybackSegment } from './immersive-player.types'

export type TransportSlot = 'a' | 'b'

export type MediaMetadataLabels = {
  artist?: string
  album?: string
}

export type ImmersivePlaybackVisualState = {
  state: 'idle' | 'loading' | 'playing' | 'paused'
  media: HTMLAudioElement | null
}

export type ImmersiveAudioTransport = {
  resolve(segment: PlaybackSegment, options?: { allowTts?: boolean }): Promise<string | null>
  prepare(
    slot: TransportSlot,
    fileUrl: string,
    meta: { title: string; artist?: string; album?: string },
  ): Promise<void>
  /** Plays prepared slot; resolves when that asset completes (or is stopped). */
  playSlot(slot: TransportSlot, playbackRate: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<boolean>
  stop(options?: { clearSession?: boolean }): Promise<void>
  setRate(playbackRate: number): Promise<void>
  hasResumableAsset(): boolean
  setMediaMetadata(
    segment: PlaybackSegment,
    playbackRate: number,
    state: 'none' | 'paused' | 'playing',
    labels?: MediaMetadataLabels,
  ): Promise<void>
  registerMediaActions(
    handlers: Partial<Record<MediaSessionAction, () => void>>,
    options?: { includeTrackSkip?: boolean },
  ): Promise<void>
  setIosGapTrackControls(
    enabled: boolean,
    handlers?: Partial<Record<'previoustrack' | 'nexttrack', () => void>>,
  ): Promise<void>
  setNativeStateHandler(handler: ((event: PlaybackStateEvent) => void) | null): void
  clearResolveCache(): void
  clearSession(): Promise<void>
  subscribeVisualState(listener: (state: ImmersivePlaybackVisualState) => void): () => void
  otherSlot(slot: TransportSlot): TransportSlot
}
