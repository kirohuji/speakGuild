import { Injectable } from '@nestjs/common';
import { MinimaxTtsProvider } from './providers/minimax-tts.provider';
import { CartesiaTtsProvider } from './providers/cartesia-tts.provider';
import { HumeTtsProvider } from './providers/hume-tts.provider';
import { TtsProvider } from './providers/tts-provider';

@Injectable()
export class TtsProviderFactory {
  private readonly providers: Map<string, TtsProvider>;

  constructor(
    private readonly minimax: MinimaxTtsProvider,
    private readonly cartesia: CartesiaTtsProvider,
    private readonly hume: HumeTtsProvider,
  ) {
    this.providers = new Map<string, TtsProvider>([
      [minimax.provider, minimax],
      [cartesia.provider, cartesia],
      [hume.provider, hume],
    ]);
  }

  getProvider(name: string): TtsProvider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Unknown TTS provider: ${name}`);
    return p;
  }
}
