export const TTS_PROVIDER_KEYS = [
  'minimax',
  'cartesia',
  'hume',
  'elevenlabs',
  'entts',
] as const;

export type TtsProviderKey = (typeof TTS_PROVIDER_KEYS)[number];

export function isTtsProviderKey(value: string): value is TtsProviderKey {
  return (TTS_PROVIDER_KEYS as readonly string[]).includes(value);
}
