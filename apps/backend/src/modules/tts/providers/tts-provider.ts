import { TtsGenerateInput, TtsGenerateResult } from '../tts.types';

export abstract class TtsProvider {
  abstract readonly provider: string;
  abstract generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult>;
}
