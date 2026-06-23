import { Module, Global } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';

@Global()
@Module({
  providers: [LlmProviderFactory],
  exports: [LlmProviderFactory],
})
export class LlmModule {}
