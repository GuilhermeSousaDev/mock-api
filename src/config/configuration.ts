export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    // No fallback on purpose: a well-known default secret would let anyone
    // forge tokens. The app refuses to boot without it (see AuthModule).
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  ai: {
    // "claude" (production), "ollama" (free local), or "remote" (hosted
    // open-source via an OpenAI-compatible endpoint — Groq, OpenRouter, ...).
    provider: process.env.AI_PROVIDER ?? 'claude',
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    // Per-task model routing: cheap model for high-volume simple calls,
    // capable model for the adaptive question + final feedback report.
    fastModel: process.env.AI_FAST_MODEL ?? 'claude-haiku-4-5',
    smartModel: process.env.AI_SMART_MODEL ?? 'claude-opus-4-8',
    // Local open-source models via Ollama (https://ollama.com) — no API cost.
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'llama3.1',
    },
    // Hosted open-source models via any OpenAI-compatible endpoint.
    remote: {
      baseUrl: process.env.REMOTE_AI_BASE_URL ?? 'https://api.groq.com/openai/v1',
      apiKey: process.env.REMOTE_AI_API_KEY,
      model: process.env.REMOTE_AI_MODEL ?? 'llama-3.3-70b-versatile',
    },
  },

  // Speech is handled client-side (Web Speech API) by default — no server cost.
  stt: {
    provider: process.env.STT_PROVIDER ?? 'browser',
  },

  tts: {
    provider: process.env.TTS_PROVIDER ?? 'browser',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    endpoint: process.env.STORAGE_ENDPOINT,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
  },
});
