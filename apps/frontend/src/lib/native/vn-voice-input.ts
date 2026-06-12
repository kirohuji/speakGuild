import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { isNative } from './platform';

const DEFAULT_LANGUAGE = 'en-US';

export type NativeVoiceInputSession =
  | {
      kind: 'speech';
      stop: () => Promise<{ text: string }>;
      cancel: () => Promise<void>;
    }
  | {
      kind: 'audio-recorder';
      stop: () => Promise<{ blob: Blob; filename: string; playbackUrl: string | null }>;
      cancel: () => Promise<void>;
    };

function isGranted(state: string | undefined) {
  return state === 'granted';
}

async function ensureSpeechPermission() {
  const current = await SpeechRecognition.checkPermissions();
  if (isGranted(current.speechRecognition)) return true;

  const requested = await SpeechRecognition.requestPermissions();
  return isGranted(requested.speechRecognition);
}

async function ensureAudioRecorderPermission() {
  const current = await CapacitorAudioRecorder.checkPermissions();
  if (isGranted(current.recordAudio)) return true;

  const requested = await CapacitorAudioRecorder.requestPermissions();
  return isGranted(requested.recordAudio);
}

async function removeHandles(handles: Array<PluginListenerHandle | null>) {
  await Promise.all(handles.map((handle) => handle?.remove?.().catch(() => undefined)));
}

function getBestPartialText(event: { accumulatedText?: string; accumulated?: string; matches?: string[] }) {
  return normalizeTranscriptText(event.accumulatedText || event.accumulated || event.matches?.[0] || '');
}

function normalizeTranscriptText(text: string | undefined | null) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function isNativeSpeechRecognitionAvailable(language = DEFAULT_LANGUAGE) {
  if (!isNative()) return false;

  const availability = await SpeechRecognition.available().catch(() => ({ available: false }));
  if (!availability.available) return false;

  // Keep this probe best-effort: some devices support the legacy native recognizer
  // even when the newer on-device path is unavailable for this language.
  await SpeechRecognition.isOnDeviceRecognitionAvailable({ language }).catch(() => undefined);
  return true;
}

export async function startNativeSpeechInput(options: {
  language?: string;
  onPartial?: (text: string) => void;
} = {}): Promise<NativeVoiceInputSession | null> {
  if (!isNative()) return null;

  const language = options.language || DEFAULT_LANGUAGE;
  const availability = await SpeechRecognition.available().catch(() => ({ available: false }));
  if (!availability.available) return null;

  const hasPermission = await ensureSpeechPermission().catch(() => false);
  if (!hasPermission) return null;

  const onDeviceAvailability = await SpeechRecognition
    .isOnDeviceRecognitionAvailable({ language })
    .catch(() => ({ available: false }));

  let latestText = '';
  const partialHandle = await SpeechRecognition.addListener('partialResults', (event) => {
    const text = getBestPartialText(event);
    if (!text) return;
    latestText = text;
    options.onPartial?.(text);
  });

  const errorHandle = await SpeechRecognition.addListener('error', (event) => {
    console.warn('[VN voice] native speech recognition error:', event);
  });

  try {
    await SpeechRecognition.start({
      language,
      maxResults: 3,
      partialResults: true,
      addPunctuation: true,
      popup: false,
      useOnDeviceRecognition: onDeviceAvailability.available,
      continuousPTT: true,
      allowForSilence: 1500,
    });
  } catch (error) {
    await removeHandles([partialHandle, errorHandle]);
    console.warn('[VN voice] native speech start failed:', error);
    return null;
  }

  return {
    kind: 'speech',
    async stop() {
      await SpeechRecognition.forceStop({ timeout: 1200 }).catch(() => SpeechRecognition.stop());
      const last = await SpeechRecognition.getLastPartialResult().catch(() => null);
      await removeHandles([partialHandle, errorHandle]);
      return { text: normalizeTranscriptText(last?.text || latestText) };
    },
    async cancel() {
      await SpeechRecognition.forceStop({ timeout: 800 }).catch(() => SpeechRecognition.stop().catch(() => undefined));
      await removeHandles([partialHandle, errorHandle]);
    },
  };
}

function filenameFromResult(uri: string | undefined, blob: Blob | undefined) {
  if (uri) {
    const clean = uri.split('?')[0] || uri;
    const ext = clean.split('.').pop();
    if (ext && ext.length <= 5) return `recording.${ext}`;
  }

  if (blob?.type.includes('mp4')) return 'recording.mp4';
  if (blob?.type.includes('mpeg')) return 'recording.mp3';
  if (blob?.type.includes('wav')) return 'recording.wav';
  if (blob?.type.includes('ogg')) return 'recording.ogg';
  return 'recording.m4a';
}

async function blobFromRecordingResult(result: { blob?: Blob; uri?: string }) {
  if (result.blob) {
    return {
      blob: result.blob,
      playbackUrl: URL.createObjectURL(result.blob),
      filename: filenameFromResult(undefined, result.blob),
    };
  }

  if (!result.uri) {
    throw new Error('No audio was returned by native recorder.');
  }

  const playbackUrl = Capacitor.convertFileSrc(result.uri);
  const response = await fetch(playbackUrl);
  const blob = await response.blob();

  return {
    blob,
    playbackUrl,
    filename: filenameFromResult(result.uri, blob),
  };
}

export async function startNativeAudioRecorder(): Promise<NativeVoiceInputSession | null> {
  if (!isNative()) return null;

  const hasPermission = await ensureAudioRecorderPermission().catch(() => false);
  if (!hasPermission) return null;

  try {
    await CapacitorAudioRecorder.startRecording({
      sampleRate: 16000,
      bitRate: 64000,
    });
  } catch (error) {
    console.warn('[VN voice] native audio recorder start failed:', error);
    return null;
  }

  return {
    kind: 'audio-recorder',
    async stop() {
      const result = await CapacitorAudioRecorder.stopRecording();
      return blobFromRecordingResult(result);
    },
    async cancel() {
      await CapacitorAudioRecorder.cancelRecording().catch(() => undefined);
    },
  };
}

export async function startBestNativeVoiceInput(options: {
  language?: string;
  onPartial?: (text: string) => void;
  useNativeSpeechRecognition?: boolean;
} = {}) {
  if (options.useNativeSpeechRecognition) {
    const speechSession = await startNativeSpeechInput(options);
    if (speechSession) return speechSession;
  }

  return startNativeAudioRecorder();
}
