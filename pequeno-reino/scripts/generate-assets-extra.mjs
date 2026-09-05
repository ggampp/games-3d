/**
 * Gera os assets da segunda leva a partir do .env local:
 *  - ElevenLabs: trilhas por estação (Music API, fallback sound-generation), SFX novos e narração PT-BR (TTS)
 *  - FAL Trellis: modelos GLB (image-to-3D) a partir das artes de tile já existentes
 *  - Gemini: ícone do app (PWA) e selos de estação
 * Nunca imprime valores de chave. Arquivos já existentes são pulados.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = new Set(process.argv.slice(2));
const want = (name) => only.size === 0 || only.has(name);

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) throw new Error('Missing .env (see .env.example).');
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}

const hasKey = (name) => Boolean(process.env[name]?.trim());
const rel = (p) => p.replace(root, '.').replace(/\\/g, '/');
const skipExisting = (dest) => existsSync(dest) && readFileSync(dest).byteLength > 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/* ------------------------------------------------------------------ */
/* ElevenLabs                                                          */
/* ------------------------------------------------------------------ */

const XI = 'https://api.elevenlabs.io/v1';
const xiHeaders = (accept = 'audio/mpeg') => ({
  'xi-api-key': process.env.ELEVENLABS_API_KEY,
  'Content-Type': 'application/json',
  Accept: accept,
});

async function xiPost(path, body) {
  const res = await fetch(`${XI}${path}`, { method: 'POST', headers: xiHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs ${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function elevenSfx(text, duration, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) return console.log(`skip ${rel(dest)}`);
  const audio = await xiPost('/sound-generation', {
    text,
    duration_seconds: Math.min(22, duration),
    prompt_influence: 0.4,
  });
  writeFileSync(dest, audio);
  console.log(`ok ElevenLabs sfx ${rel(dest)}`);
}

async function elevenMusic(prompt, lengthMs, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) return console.log(`skip ${rel(dest)}`);
  try {
    const audio = await xiPost('/music', { prompt, music_length_ms: lengthMs });
    writeFileSync(dest, audio);
    console.log(`ok ElevenLabs music ${rel(dest)}`);
  } catch (error) {
    console.warn(`music api falhou (${error.message.slice(0, 120)}); usando sound-generation 22s`);
    const audio = await xiPost('/sound-generation', {
      text: `${prompt}. Seamless loop, instrumental, no vocals.`,
      duration_seconds: 22,
      prompt_influence: 0.3,
    });
    writeFileSync(dest, audio);
    console.log(`ok ElevenLabs sfx-as-music ${rel(dest)}`);
  }
}

let voiceId = null;
async function pickVoice() {
  if (voiceId) return voiceId;
  const res = await fetch(`${XI}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  if (!res.ok) {
    // Chave sem permissão voices_read: usa a voz pré-definida "Sarah" (premade, multilíngue).
    voiceId = 'EXAVITQu4vr4xnSDxMaL';
    console.log(`voice: fallback premade (${res.status} em /voices)`);
    return voiceId;
  }
  const data = await res.json();
  const voices = data.voices ?? [];
  // Preferência: Keren (narradora brasileira), depois qualquer voz pt-BR, depois inglês.
  const preferred =
    voices.find((v) => v.voice_id === '33B4UnXyTNbgLmdEDh5P') ??
    voices.find((v) => /brazil/i.test(JSON.stringify(v.labels ?? {}))) ??
    voices.find((v) => /portug/i.test(JSON.stringify(v.labels ?? {}))) ??
    voices[0];
  if (!preferred) throw new Error('no voices available');
  voiceId = preferred.voice_id;
  console.log(`voice: ${preferred.name}`);
  return voiceId;
}

async function elevenTts(text, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) return console.log(`skip ${rel(dest)}`);
  const id = await pickVoice();
  const audio = await xiPost(`/text-to-speech/${id}?output_format=mp3_44100_96`, {
    text,
    model_id: 'eleven_multilingual_v2',
    language_code: 'pt',
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, speed: 0.92 },
  });
  writeFileSync(dest, audio);
  console.log(`ok ElevenLabs tts ${rel(dest)}`);
}

const MUSIC_STYLE =
  'Gentle cozy folk lullaby for a paper diorama village game, acoustic nylon guitar, soft marimba, light flute, slow tempo, warm, no drums, no vocals, instrumental only, loopable';

const MUSIC = [
  ['primavera', `${MUSIC_STYLE}, spring morning, birdsong feel, bright and hopeful`],
  ['verao', `${MUSIC_STYLE}, summer afternoon, lazy and sunny, subtle cicada rhythm`],
  ['outono', `${MUSIC_STYLE}, autumn river, wistful, flowing arpeggios`],
  ['inverno', `${MUSIC_STYLE}, winter mountain mist, sparse, music box and low strings`],
  ['ciclo', `${MUSIC_STYLE}, whole kingdom celebration, full but calm, all seasons blended`],
];

const SFX = [
  ['discard.mp3', 'Single paper card flicked and dropped on a wooden table, soft, 0.4 seconds', 0.5],
  ['undo.mp3', 'Short reverse whoosh of a paper card sliding back, soft, 0.4 seconds', 0.5],
  ['hover.mp3', 'Very subtle paper tick, ultra short, quiet, 0.2 seconds', 0.5],
  ['star.mp3', 'Tiny sparkle chime, small bell ding, warm, 0.8 seconds', 0.9],
  ['unlock.mp3', 'Small wooden chest opening with a gentle harp glissando, cozy, 1.2 seconds', 1.3],
  ['quest.mp3', 'Soft two-note wooden xylophone success, cozy, 0.7 seconds', 0.8],
];

const VOICE = [
  ['title', 'Bem-vindo ao Pequeno Reino. Cada carta é um pedaço de chão, um telhado, ou um aldeão.'],
  ['tutorial-1', 'Escolha uma carta na mão e toque num hexágono vizinho para posar.'],
  ['tutorial-2', 'Prédios ganham mais quando ficam ao lado dos vizinhos certos. O engenho adora uma roça.'],
  ['tutorial-3', 'Natureza, Povo e Água são as três cores do reino. Um reino equilibrado rende mais estrelas.'],
  ['phase-1', 'Primavera na clareira. Aprenda a posar o chão e chamar gente.'],
  ['phase-2', 'Verão na mata. Sombra, madeira e o primeiro engenho.'],
  ['phase-3', 'Outono no rio. Água quer companhia. Pão quer engenho.'],
  ['phase-4', 'Inverno na serra. Pedra, cais, e um sino na bruma.'],
  ['phase-5', 'O reino inteiro. Todas as cartas, sem pressa. O álbum espera.'],
  ['complete', 'A fase descansou no mapa. O reino agradece.'],
  ['asleep', 'O reino adormeceu. Nada se perde. Tente de novo com o que já descobriu.'],
];

/* ------------------------------------------------------------------ */
/* FAL Trellis (image → GLB)                                           */
/* ------------------------------------------------------------------ */

const MODELS = ['moinho_vento', 'capela', 'farol', 'engenho', 'sobrado', 'cais', 'escola', 'mercado'];

async function falTrellis(imagePath, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) return console.log(`skip ${rel(dest)}`);
  const png = readFileSync(imagePath);
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  const headers = { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
  const submit = await fetch('https://queue.fal.run/fal-ai/trellis', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_url: dataUri,
      ss_guidance_strength: 7.5,
      ss_sampling_steps: 12,
      slat_guidance_strength: 3,
      slat_sampling_steps: 12,
      mesh_simplify: 0.95,
      texture_size: 1024,
    }),
  });
  if (!submit.ok) throw new Error(`FAL submit HTTP ${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  const job = await submit.json();
  const statusUrl = job.status_url;
  const responseUrl = job.response_url;
  if (!statusUrl || !responseUrl) throw new Error('FAL queue response missing urls');

  const started = Date.now();
  for (;;) {
    await sleep(4000);
    const st = await fetch(statusUrl, { headers });
    if (!st.ok) throw new Error(`FAL status HTTP ${st.status}`);
    const status = await st.json();
    if (status.status === 'COMPLETED') break;
    if (status.status === 'FAILED') throw new Error('FAL job failed');
    if (Date.now() - started > 8 * 60 * 1000) throw new Error('FAL job timeout');
  }
  const out = await fetch(responseUrl, { headers });
  if (!out.ok) throw new Error(`FAL result HTTP ${out.status}`);
  const result = await out.json();
  const url = result?.model_mesh?.url;
  if (!url) throw new Error('FAL result missing model_mesh.url');
  await download(url, dest);
  console.log(`ok FAL trellis ${rel(dest)}`);
}

/* ------------------------------------------------------------------ */
/* Gemini (imagens)                                                    */
/* ------------------------------------------------------------------ */

const STYLE =
  'Paper diorama miniature, cute stylized, cream terracotta moss-green palette, children book illustration, flat solid cream background #F4E8D0, no text, no letters, no watermark, original design.';

const IMAGES = [
  ['icon-512.png', `${STYLE} App icon: a single small hexagonal tile with a clay-roof cottage and one round tree, centered, bold and readable at small size, square composition.`],
  ['seasons/primavera.png', `${STYLE} Round badge: spring meadow with wildflowers and a small sprout, centered circular emblem.`],
  ['seasons/verao.png', `${STYLE} Round badge: summer forest grove with sun rays and round trees, centered circular emblem.`],
  ['seasons/outono.png', `${STYLE} Round badge: autumn river bend with orange leaves and a wooden dock, centered circular emblem.`],
  ['seasons/inverno.png', `${STYLE} Round badge: winter mountain with snow cap and a tiny chapel bell, centered circular emblem.`],
  ['seasons/ciclo.png', `${STYLE} Round badge: four seasons blended in a ring around a tiny kingdom, centered circular emblem.`],
  ['paper-texture.png', 'Seamless tileable subtle cream handmade paper texture, very light fibers, no text, flat lighting, square.'],
];

async function geminiImage(prompt, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) return console.log(`skip ${rel(dest)}`);
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part) => part.inlineData?.data);
  if (!inline?.inlineData?.data) throw new Error('Gemini response missing image bytes');
  writeFileSync(dest, Buffer.from(inline.inlineData.data, 'base64'));
  console.log(`ok Gemini ${rel(dest)}`);
}

/* ------------------------------------------------------------------ */

async function safe(label, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`FALHOU ${label}: ${error.message}`);
  }
}

async function main() {
  loadEnv();
  console.log(
    `providers: FAL=${hasKey('FAL_KEY')} Gemini=${hasKey('GEMINI_API_KEY')} ElevenLabs=${hasKey('ELEVENLABS_API_KEY')}`,
  );
  const audioDir = join(root, 'public', 'audio');
  const imgDir = join(root, 'public', 'images');
  const modelDir = join(root, 'public', 'models');

  if (want('images') && hasKey('GEMINI_API_KEY')) {
    for (const [file, prompt] of IMAGES) await safe(file, () => geminiImage(prompt, join(imgDir, file)));
  }

  if (want('audio') && hasKey('ELEVENLABS_API_KEY')) {
    for (const [file, prompt, duration] of SFX) await safe(file, () => elevenSfx(prompt, duration, join(audioDir, file)));
    for (const [name, text] of VOICE) await safe(name, () => elevenTts(text, join(audioDir, 'voice', `${name}.mp3`)));
    for (const [name, prompt] of MUSIC) await safe(name, () => elevenMusic(prompt, 45000, join(audioDir, 'music', `${name}.mp3`)));
  }

  if (want('models') && hasKey('FAL_KEY')) {
    for (const id of MODELS) {
      const src = join(imgDir, 'tiles', `${id}.png`);
      if (!existsSync(src)) continue;
      await safe(id, () => falTrellis(src, join(modelDir, `${id}.glb`)));
    }
  }

  console.log('done');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
