import { Injectable } from '@nestjs/common';
import { SttProvider } from './stt-provider';
import { WhisperSttProvider } from './whisper-stt.provider';
import { TencentSttProvider } from './tencent-stt.provider';

@Injectable()
export class SttProviderFactory {
  private readonly providers: Map<string, SttProvider>;

  constructor(
    private readonly whisper: WhisperSttProvider,
    private readonly tencent: TencentSttProvider,
  ) {
    this.providers = new Map<string, SttProvider>([
      [whisper.provider, whisper],
      [tencent.provider, tencent],
    ]);
  }

  /**
   * 按名称获取供应商实例
   * @param name 供应商标识，如 'whisper' / 'tencent'
   */
  getProvider(name: string): SttProvider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Unknown STT provider: ${name}`);
    return p;
  }
}
