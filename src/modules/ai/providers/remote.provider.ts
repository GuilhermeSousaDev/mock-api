import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatProvider, describeHttpStatus } from './base-chat.provider';
import { ProviderHealth } from './ai-provider.interface';

/**
 * Hosted open-source models via any OpenAI-compatible endpoint (Groq,
 * OpenRouter, Together, Cerebras, HF router, local LM Studio, ...). No model
 * download required and most have a free tier. "OpenAI-compatible" refers only
 * to the wire format (POST /chat/completions) — not OpenAI's models or SDK.
 * Enable with AI_PROVIDER=remote and set REMOTE_AI_BASE_URL / _API_KEY / _MODEL.
 */
@Injectable()
export class RemoteProvider extends BaseChatProvider {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly logger = new Logger(RemoteProvider.name);

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config.get<string>('ai.remote.baseUrl') ?? 'https://api.groq.com/openai/v1';
    this.apiKey = config.get<string>('ai.remote.apiKey');
    this.model = config.get<string>('ai.remote.model') ?? 'llama-3.3-70b-versatile';
  }

  async healthCheck(): Promise<ProviderHealth> {
    const base = { provider: 'remote', model: this.model };
    if (!this.apiKey) {
      return { ...base, ok: false, message: 'REMOTE_AI_API_KEY is not set.' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        return { ...base, ok: true, status: 200, message: 'Connected.' };
      }
      const body = await res.text().catch(() => '');
      return {
        ...base,
        ok: false,
        status: res.status,
        message: describeHttpStatus(res.status, body.slice(0, 200)),
      };
    } catch (err) {
      return {
        ...base,
        ok: false,
        message: `Could not reach ${this.baseUrl}: ${(err as Error).message}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  protected async chat(prompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.error(
          `Remote AI returned HTTP ${res.status}: ${await res.text().catch(() => '')}`,
        );
        return null;
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.error('Remote AI call failed', err as Error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
