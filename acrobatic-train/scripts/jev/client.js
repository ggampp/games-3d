import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Automatically load .env if available
try {
  if (process.loadEnvFile) {
    process.loadEnvFile();
  } else {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k && v.length) {
          process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
} catch {
  // Silent fallback if .env not present
}

export const API_URL = 'https://api.typesafe.ai/v1/systemone';
export const DEFAULT_MODEL = process.env.TYPESAFE_MODEL || 'jev-latest';

/**
 * Question helper constructors matching the TypeSafe System One spec
 */
export function noul(instructions, criteria = null) {
  const q = { type: 'noul', instructions };
  if (criteria) q.criteria = criteria;
  return q;
}

export function choice(instructions, criteria) {
  return { type: 'choice', instructions, criteria };
}

export function score(instructions, criteria) {
  return { type: 'score', instructions, criteria };
}

/**
 * Sends a structured request to TypeSafe Jev System One
 * @param {object|string|array} state - Context to evaluate
 * @param {Record<string, object>} questions - Map of question definitions
 * @param {object} [options]
 * @returns {Promise<{ model: string, answers: Record<string, any>, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function askJev(state, questions, options = {}) {
  const apiKey = options.apiKey || process.env.TYPESAFE_API_KEY;
  const model = options.model || DEFAULT_MODEL;

  if (!apiKey || apiKey === 'your_typesafe_api_key_here') {
    if (options.mockFallback !== false) {
      console.warn('\n⚠️ [TypeSafe Jev] No TYPESAFE_API_KEY detected. Running in simulated fallback mode.');
      console.warn('  To connect to live Jev, set TYPESAFE_API_KEY in .env or your environment.\n');
      return simulateMockAnswers(state, questions, model);
    }
    throw new Error('TYPESAFE_API_KEY is required to evaluate questions with Jev.');
  }

  const payload = {
    state,
    model,
    questions,
  };

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429 || res.status === 529) {
        retries--;
        if (retries === 0) {
          const errText = await res.text();
          throw new Error(`TypeSafe API rate limit or overloaded (${res.status}): ${errText}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`TypeSafe API Error (${res.status}): ${errText}`);
      }

      return await res.json();
    } catch (err) {
      if (retries <= 1) throw err;
      retries--;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

/**
 * Fallback heuristic simulator for testing tools locally without spending API credits
 */
function simulateMockAnswers(state, questions, model) {
  const answers = {};
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);

  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      const instLower = typeof q.instructions === 'string' ? q.instructions.toLowerCase() : JSON.stringify(q.instructions).toLowerCase();
      // Check typical triggers
      let prob = 0.05;
      if (instLower.includes('violate') || instLower.includes('break') || instLower.includes('security') || instLower.includes('secret')) {
        const containsRisk = stateStr.includes('password') || stateStr.includes('SECRET') || stateStr.includes('apiKey = "123"');
        prob = containsRisk ? 0.96 : 0.02;
      } else if (instLower.includes('cover') || instLower.includes('test')) {
        prob = stateStr.toLowerCase().includes('test') ? 0.92 : 0.15;
      }
      answers[key] = {
        type: 'noul',
        noul: prob,
      };
    } else if (q.type === 'choice') {
      const keys = Object.keys(q.criteria || {});
      const choicePick = keys[0] || 'none';
      const probs = {};
      keys.forEach((k, idx) => {
        probs[k] = idx === 0 ? 0.85 : Number((0.15 / (keys.length - 1 || 1)).toFixed(2));
      });
      answers[key] = {
        type: 'choice',
        choice: choicePick,
        probabilities: probs,
        confidence: 0.85,
      };
    } else if (q.type === 'score') {
      answers[key] = {
        type: 'score',
        score: 0.5,
        probabilities: { '0': 0.7, '1': 0.3 },
        confidence: 0.75,
      };
    }
  }

  return {
    model: `${model}-mock-preview`,
    answers,
    usage: { input_tokens: 150, output_tokens: 25 },
  };
}
