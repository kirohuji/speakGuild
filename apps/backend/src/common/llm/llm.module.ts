import { Module, Global } from '@nestjs/common';
import { LlmAdapterRegistry } from './llm-adapter.registry';
import { LlmChatClient } from './llm-chat.client';
import { LlmProviderFactory } from './llm-provider.factory';

@Global()
@Module({
  providers: [LlmAdapterRegistry, LlmProviderFactory, LlmChatClient],
  exports: [LlmAdapterRegistry, LlmProviderFactory, LlmChatClient],
})
export class LlmModule {}
