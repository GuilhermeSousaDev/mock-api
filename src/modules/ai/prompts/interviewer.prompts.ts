import { DifficultyLevel, Language } from '@prisma/client';

export const INTERVIEWER_PERSONA = `You are Alex, an experienced senior software engineer conducting a mock technical interview.
You are professional, encouraging, and precise. You ask one clear question at a time.
You adapt your depth and expectations to the candidate's target level.
Always return valid JSON as specified — no markdown, no prose outside JSON.`;

const LEVEL_GUIDANCE: Record<DifficultyLevel, string> = {
  ENTRY: `Entry-level expectations: foundational CS concepts, basic data structures, simple coding problems, awareness of web fundamentals.
Score generously for correct direction even if implementation is imperfect.`,

  JUNIOR: `Junior-level expectations: solid programming fundamentals, common data structures & algorithms, basic REST API design, version control understanding.
Expect working solutions with some guidance needed on edge cases.`,

  MID: `Mid-level expectations: strong DS&A, system design basics (caching, databases, APIs), code quality awareness, debugging skills, understanding of tradeoffs.
Expect complete, reasonably optimized solutions with minimal prompting.`,

  SENIOR: `Senior-level expectations: deep system design, scalability tradeoffs, architectural decisions, cross-team impact, code review quality, mentoring awareness.
Expect thorough answers covering edge cases, performance, and reliability.`,

  STAFF: `Staff-level expectations: org-wide technical direction, complex distributed systems, cross-functional leadership, strategic technical decisions, system reliability at scale.
Expect comprehensive analysis with explicit tradeoff reasoning and risk awareness.`,

  PRINCIPAL: `Principal-level expectations: company-wide technical vision, deep expertise across multiple domains, ability to define engineering strategy, influential technical leadership.
Expect mastery-level depth plus the ability to communicate complex tradeoffs to non-technical stakeholders.`,
};

export function buildLevelGuidance(level: DifficultyLevel): string {
  return LEVEL_GUIDANCE[level];
}

const LANGUAGE_GUIDANCE: Record<Language, string> = {
  EN: `Conduct the entire interview in English. All question text, evaluations, and feedback must be written in natural English.`,

  PT_BR: `Conduza toda a entrevista em português do Brasil (pt-BR). Todo o texto das perguntas, avaliações e feedback deve ser escrito em português brasileiro natural e profissional. Mantenha termos técnicos consagrados em inglês quando for o uso comum na área (ex.: "deploy", "endpoint", "cache"). The JSON structure, keys, and enum values (e.g. "WARMUP", "TECHNICAL") must remain exactly as specified in English — translate only the human-readable string values.`,
};

export function buildLanguageGuidance(language: Language): string {
  return LANGUAGE_GUIDANCE[language];
}

/**
 * Teaches the model to behave like a real interviewer: probe a topic in depth
 * (a FOLLOWUP that drills into the same area) before moving on to a new one.
 * Bounded so a single topic can't consume the whole interview, and pacing-aware
 * so it doesn't open a deep new thread when the question budget is nearly spent.
 */
export function buildProbingGuidance(
  followUpDepth: number,
  maxFollowUps: number,
  questionsRemaining: number,
): string {
  const mustMoveOn = followUpDepth >= maxFollowUps;
  return `A real interviewer probes a topic in depth before moving on, to find the edge of what the candidate truly knows. For the next question, choose one move:
- PROBE DEEPER ("type": "FOLLOWUP"): stay on the SAME topic as the previous answer when it was partial, surface-level, or worth pressure-testing. Build directly on what they just said and push for specifics — edge cases, tradeoffs, "why", "how would you handle…". Keep or slightly raise the difficulty.
- MOVE ON ("type": "TECHNICAL"): switch to a new topic when the current one is exhausted — the candidate clearly mastered it, or clearly doesn't know it and more probing would only frustrate. After a weak answer, ease the difficulty slightly.
Follow-ups already asked on the current topic: ${followUpDepth} of a maximum ${maxFollowUps}.${
    mustMoveOn
      ? ' You have reached the limit for this topic — you MUST move on to a new topic now ("type": "TECHNICAL").'
      : ''
  }
About ${questionsRemaining} question(s) remain — don't open a brand-new deep topic if almost none are left; prefer to wrap up the current thread.`;
}

/**
 * Prompt for cleaning up a speech-to-text answer: fix English technical terms that
 * the browser recognizer mangled, while leaving the candidate's actual words intact.
 * Returns plain text (the corrected transcript), not JSON.
 */
export function buildTranscriptNormalizationPrompt(
  transcript: string,
  language: Language,
): string {
  const langNote =
    language === Language.PT_BR
      ? 'The text is in Brazilian Portuguese and may contain English technical terms spoken with an accent that were garbled by speech recognition.'
      : 'The text is in English.';

  return `The following text is a speech-to-text transcript of a candidate's spoken answer in a technical programming interview. Speech recognition frequently mangles English technical terms — library names, tools, APIs, and jargon (e.g. "GitHub", "jsonwebtoken", "JWT", "Node.js", "PostgreSQL", "Kubernetes").

${langNote}

Correct ONLY words that were clearly mis-transcribed technical terms, restoring their standard spelling and casing. Preserve everything else exactly: same language, same meaning, same wording, same sentence structure. Do not translate, do not fix grammar, do not rephrase, do not add or remove content, and do not answer or comment on the text.

Return only the corrected transcript text — no preamble, quotes, or explanation.

Transcript:
${transcript}`;
}

/**
 * Guard the model's output before trusting it as a transcript. Falls back to the
 * original when the reply is empty, or when its length drifts far enough from the
 * source that the model likely refused, truncated, or added commentary.
 */
export function sanitizeNormalizedTranscript(
  cleaned: string | null,
  original: string,
): string {
  if (!cleaned) return original;
  const text = cleaned.trim();
  const baseline = original.trim().length;
  if (!text || text.length > baseline * 1.5 + 40 || text.length < baseline * 0.5) {
    return original;
  }
  return text;
}
