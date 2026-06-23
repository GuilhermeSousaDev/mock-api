import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatProvider } from './base-chat.provider';
import { ProviderHealth } from './ai-provider.interface';

/**
 * Free, local open-source models via Ollama (https://ollama.com) for testing.
 * Talks to Ollama's native REST API over plain fetch — no SDK dependency.
 * Enable with AI_PROVIDER=ollama.
 */
@Injectable()
export class OllamaProvider extends BaseChatProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly logger = new Logger(OllamaProvider.name);

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('ai.ollama.baseUrl') ?? 'http://localhost:11434';
    this.model = config.get<string>('ai.ollama.model') ?? 'llama3.1';
  }

  async healthCheck(): Promise<ProviderHealth> {
    const base = { provider: 'ollama', model: this.model };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      if (!res.ok) {
        return { ...base, ok: false, status: res.status, message: 'Ollama is not reachable.' };
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const names = (data.models ?? []).map((m) => m.name);
      const present = names.some((n) => n === this.model || n.startsWith(`${this.model}:`));
      return present
        ? { ...base, ok: true, status: 200, message: 'Connected.' }
        : {
            ...base,
            ok: false,
            status: 200,
            message: `Ollama is running but model "${this.model}" is not pulled. Run: ollama pull ${this.model}`,
          };
    } catch {
      return { ...base, ok: false, message: `Ollama not reachable at ${this.baseUrl} — is it running?` };
    } finally {
      clearTimeout(timeout);
    }
  }

  protected async chat(prompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.7 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.error(`Ollama returned HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content ?? null;
    } catch (err) {
      this.logger.error('Ollama call failed', err as Error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
