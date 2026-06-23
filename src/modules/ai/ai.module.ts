import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AI_PROVIDER } from './ai.constants';
import { ClaudeProvider } from './providers/claude.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { RemoteProvider } from './providers/remote.provider';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    ClaudeProvider,
    OllamaProvider,
    RemoteProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, ClaudeProvider, OllamaProvider, RemoteProvider],
      useFactory: (
        config: ConfigService,
        claude: ClaudeProvider,
        ollama: OllamaProvider,
        remote: RemoteProvider,
      ) => {
        switch (config.get<string>('ai.provider')) {
          case 'ollama':
            return ollama;
          case 'remote':
            return remote;
          default:
            return claude;
        }
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
