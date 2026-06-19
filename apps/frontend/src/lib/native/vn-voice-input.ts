import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import {
  AudioSessionMode,
  CapacitorAudioRecorder,
  type StartRecordingOptions,
  type StopRecordingResult,
} from '@capgo/capacitor-audio-recorder';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { getPlatform, isNative } from './platform';

const DEFAULT_LANGUAGE = 'en-US';
const MIN_NATIVE_RECORDING_DURATION_MS = 300;
const VOICE_LOG_PREFIX = '[VN voice]';

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
  console.log(`${VOICE_LOG_PREFIX} ensureAudioRecorderPermission: checking...`);
  const current = await CapacitorAudioRecorder.checkPermissions();
  console.log(`${VOICE_LOG_PREFIX} ensureAudioRecorderPermission: current =`, current);
  if (isGranted(current.recordAudio)) {
    console.log(`${VOICE_LOG_PREFIX} ensureAudioRecorderPermission: already granted`);
    return true;
  }

  console.log(`${VOICE_LOG_PREFIX} ensureAudioRecorderPermission: requesting...`);
  const requested = await CapacitorAudioRecorder.requestPermissions();
  console.log(`${VOICE_LOG_PREFIX} ensureAudioRecorderPermission: requested =`, requested);
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function blobFromRecordingResult(result: StopRecordingResult) {
  console.log(`${VOICE_LOG_PREFIX} blobFromRecordingResult: entering`, {
    duration: result.duration,
    hasUri: Boolean(result.uri),
    hasBlob: Boolean(result.blob),
  });

  if (result.blob) {
    console.log(`${VOICE_LOG_PREFIX} blobFromRecordingResult: using result.blob directly`);
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
  console.log(`${VOICE_LOG_PREFIX} blobFromRecordingResult: reading file via Filesystem`, {
    uri: result.uri,
    playbackUrl,
  });

  const { data } = await Filesystem.readFile({ path: result.uri });
  const blob =
    data instanceof Blob ? data : base64ToBlob(data as string, 'audio/m4a');
  console.log(`${VOICE_LOG_PREFIX} blobFromRecordingResult: blob ready`, { blobSize: blob.size });

  return {
    blob,
    playbackUrl,
    filename: filenameFromResult(result.uri, blob),
  };
}

function getNativeRecorderOptions(): StartRecordingOptions {
  if (getPlatform() === 'ios') {
    return {
      audioSessionMode: AudioSessionMode.Default,
    };
  }

  return {
    sampleRate: 16000,
    bitRate: 64000,
  };
}

function describeNativeRecorderResult(result: StopRecordingResult) {
  return {
    duration: result.duration,
    hasBlob: Boolean(result.blob),
    blobSize: result.blob?.size,
    blobType: result.blob?.type,
    uri: result.uri,
  };
}

export async function startNativeAudioRecorder(): Promise<NativeVoiceInputSession | null> {
  console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: entry`, {
    isNative: isNative(),
    platform: getPlatform(),
  });

  if (!isNative()) {
    console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: not native -> return null`);
    return null;
  }

  const hasPermission = await ensureAudioRecorderPermission().catch((err) => {
    console.error(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: permission check threw`, err);
    return false;
  });
  console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: hasPermission =`, hasPermission);
  if (!hasPermission) return null;

  const options = getNativeRecorderOptions();
  try {
    console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: calling startRecording`, {
      platform: getPlatform(),
      options,
    });
    const startResult = await CapacitorAudioRecorder.startRecording(options);
    console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: startRecording returned`, startResult);
  } catch (error) {
    console.error(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: startRecording FAILED`, error);
    return null;
  }

  const sessionStartTime = Date.now();
  console.log(`${VOICE_LOG_PREFIX} startNativeAudioRecorder: session created at`, new Date(sessionStartTime).toISOString());

  return {
    kind: 'audio-recorder',
    async stop() {
      const elapsed = Date.now() - sessionStartTime;
      console.log(`${VOICE_LOG_PREFIX} stop() called, elapsed since start = ${elapsed}ms`);
      console.log(`${VOICE_LOG_PREFIX} stop() calling CapacitorAudioRecorder.stopRecording...`);
      const result = await CapacitorAudioRecorder.stopRecording();
      console.log(`${VOICE_LOG_PREFIX} stop() stopRecording returned`, describeNativeRecorderResult(result));
      try {
        const recording = await blobFromRecordingResult(result);
        console.log(`${VOICE_LOG_PREFIX} stop() blobFromRecordingResult SUCCESS`, {
          filename: recording.filename,
          playbackUrl: recording.playbackUrl,
          blobSize: recording.blob.size,
          blobType: recording.blob.type,
        });
        return recording;
      } catch (error) {
        console.error(`${VOICE_LOG_PREFIX} stop() blobFromRecordingResult FAILED`, {
          result: describeNativeRecorderResult(result),
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      }
    },
    async cancel() {
      const elapsed = Date.now() - sessionStartTime;
      console.log(`${VOICE_LOG_PREFIX} cancel() called, elapsed since start = ${elapsed}ms`);
      await CapacitorAudioRecorder.cancelRecording().catch((err) => {
        console.warn(`${VOICE_LOG_PREFIX} cancel() cancelRecording error`, err);
      });
      console.log(`${VOICE_LOG_PREFIX} cancel() done`);
    },
  };
}

export async function startBestNativeVoiceInput(options: {
  language?: string;
  onPartial?: (text: string) => void;
  useNativeSpeechRecognition?: boolean;
} = {}) {
  console.log(`${VOICE_LOG_PREFIX} startBestNativeVoiceInput: entry`, {
    useNativeSpeechRecognition: options.useNativeSpeechRecognition,
    language: options.language,
    platform: getPlatform(),
    isNative: isNative(),
  });

  if (options.useNativeSpeechRecognition) {
    console.log(`${VOICE_LOG_PREFIX} startBestNativeVoiceInput: trying speech recognition path...`);
    const speechSession = await startNativeSpeechInput(options);
    if (speechSession) {
      console.log(`${VOICE_LOG_PREFIX} startBestNativeVoiceInput: speech recognition session created`);
      return speechSession;
    }
    console.log(`${VOICE_LOG_PREFIX} startBestNativeVoiceInput: speech recognition unavailable, falling back to audio recorder`);
  }

  console.log(`${VOICE_LOG_PREFIX} startBestNativeVoiceInput: starting audio recorder...`);
  return startNativeAudioRecorder();
}
