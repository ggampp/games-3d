/**
 * Gera arte (FAL, com fallback Gemini) e áudio (ElevenLabs) a partir do .env local.
 * Nunca imprime valores de chave. Arquivos vão para public/ (servidos pelo Vite).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    throw new Error('Missing .env (see .env.example).');
  }
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

function hasKey(name) {
  return Boolean(process.env[name]?.trim());
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function skipExisting(dest) {
  return existsSync(dest) && readFileSync(dest).byteLength > 800;
}

const STYLE =
  'Paper diorama miniature, cute stylized, cream terracotta moss-green palette, children book, isolated subject, flat solid cream background #F4E8D0, no text, no letters, no watermark, three-quarter view, original design.';

const TILES = [
  ['clareira', 'tiny hexagonal meadow clearing with short grass and wildflowers'],
  ['mata', 'tiny hexagonal Atlantic forest grove with three stylized round trees'],
  ['rio', 'tiny hexagonal river tile with clear blue water and smooth stones'],
  ['monte', 'tiny hexagonal warm mountain with a small snow cap'],
  ['roca', 'tiny hexagonal farm plot with corn and cassava rows'],
  ['pomar', 'tiny hexagonal orchard with two fruit trees and orange fruit'],
  ['engenho', 'tiny hexagonal wooden sugar mill with a water wheel'],
  ['padaria', 'tiny hexagonal bakery cottage with terracotta roof and chimney'],
  ['serraria', 'tiny hexagonal lumber shed with stacked pale timber'],
  ['cabana_mateiro', 'tiny hexagonal forest cabin with mossy roof among trees'],
  ['cais', 'tiny hexagonal wooden dock over blue water'],
  ['pedreira', 'tiny hexagonal quarry with stacked warm stones'],
  ['casa', 'tiny hexagonal clay-roof cottage'],
  ['sobrado', 'tiny hexagonal two-storey colonial townhouse terracotta roof'],
  ['mercado', 'tiny hexagonal open market stall with red awning'],
  ['capela', 'tiny hexagonal white chapel with a small bell'],
  ['aldeao', 'tiny hexagonal grass tile with a small stylized villager standing, no face detail'],
  ['trigo', 'tiny hexagonal wheat field with golden grain rows'],
  ['horta', 'tiny hexagonal vegetable garden with tomato cabbage and carrot rows'],
  ['poco', 'tiny hexagonal village stone well with wooden crank and hanging bucket'],
  ['vinha', 'tiny hexagonal vineyard with grape vines on wooden stakes'],
  ['moinho_vento', 'tiny hexagonal white windmill cottage with four cream cloth sails'],
  ['estabulo', 'tiny hexagonal wooden stable with hay pile and a small horse'],
  ['moleiro', 'tiny hexagonal grass tile with a miller villager in flour-dusted clothes, no face'],
  ['lago', 'tiny hexagonal still pond with reeds and blue water'],
  ['ponte', 'tiny hexagonal wooden footbridge over a blue stream'],
  ['escola', 'tiny hexagonal schoolhouse with blue roof and a small bell'],
  ['padeiro', 'tiny hexagonal grass tile with a baker in white apron, no face'],
  ['olaria', 'tiny hexagonal pottery kiln with terracotta pots beside it'],
  ['farol', 'tiny hexagonal red and white striped lighthouse with a lantern'],
  ['casa_pedra', 'tiny hexagonal stone cottage with brown clay roof'],
  ['pescador', 'tiny hexagonal dock tile with a fisher holding a rod, no face'],
];

const EXTRA_IMAGES = [
  [
    'title-hero.png',
    `${STYLE} A pocket Lusophone kingdom of hex tiles, houses and trees, isometric diorama, no text.`,
  ],
  [
    'card-back.png',
    `${STYLE} Game card back, decorative cream paper with a simple terracotta hex motif, no text.`,
  ],
];

const SFX = [
  ['place.mp3', 'Short cozy wooden hex tile placed on a table, ceramic clack, warm, 0.5 seconds', 0.8],
  ['pack.mp3', 'Soft card pack shuffle, paper cards, cozy, 0.7 seconds', 1.0],
  ['complete.mp3', 'Gentle village bell chime success, warm and small, 1.2 seconds', 1.4],
  ['click.mp3', 'Soft UI wood tap, very short, 0.5 seconds', 0.5],
  ['asleep.mp3', 'Soft sleepy lull wind chime fading down, peaceful, 1.4 seconds', 1.6],
];

async function falImage(prompt, dest) {
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'square',
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FAL HTTP ${res.status}: ${body.slice(0, 180)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('FAL response missing image url');
  await download(url, dest);
}

async function geminiImage(prompt, dest) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 180)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part) => part.inlineData?.data);
  if (!inline?.inlineData?.data) throw new Error('Gemini response missing image bytes');
  writeFileSync(dest, Buffer.from(inline.inlineData.data, 'base64'));
}

async function makeImage(prompt, dest, preferFal) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) {
    console.log(`skip ${dest.replace(root, '.')}`);
    return;
  }
  const errors = [];
  const order = preferFal
    ? [
        ['FAL', falImage],
        ['Gemini', geminiImage],
      ]
    : [
        ['Gemini', geminiImage],
        ['FAL', falImage],
      ];
  for (const [name, fn] of order) {
    const needed = name === 'FAL' ? 'FAL_KEY' : 'GEMINI_API_KEY';
    if (!hasKey(needed)) continue;
    try {
      await fn(prompt, dest);
      console.log(`ok ${name} ${dest.replace(root, '.')}`);
      return;
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'no image provider configured');
}

async function elevenSfx(text, duration, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) {
    console.log(`skip ${dest.replace(root, '.')}`);
    return;
  }
  if (!hasKey('ELEVENLABS_API_KEY')) throw new Error('ELEVENLABS_API_KEY empty');
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      duration_seconds: duration,
      prompt_influence: 0.35,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs HTTP ${res.status}: ${body.slice(0, 180)}`);
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`ok ElevenLabs ${dest.replace(root, '.')}`);
}

async function elevenAmbience(dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (skipExisting(dest)) {
    console.log(`skip ${dest.replace(root, '.')}`);
    return;
  }
  await elevenSfx(
    'Soft looping countryside village ambience, distant birds, light breeze through grass, far market murmur, warm peaceful, no melody, no lyrics',
    12,
    dest,
  );
}

async function main() {
  loadEnv();
  const imgDir = join(root, 'public', 'images');
  const tileDir = join(imgDir, 'tiles');
  const audioDir = join(root, 'public', 'audio');
  mkdirSync(tileDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });

  console.log(
    `providers: FAL=${hasKey('FAL_KEY')} Gemini=${hasKey('GEMINI_API_KEY')} ElevenLabs=${hasKey('ELEVENLABS_API_KEY')} Tripo=${hasKey('TRIPO_API_KEY')}`,
  );

  await makeImage(EXTRA_IMAGES[0][1], join(imgDir, EXTRA_IMAGES[0][0]), false);
  await makeImage(EXTRA_IMAGES[1][1], join(imgDir, EXTRA_IMAGES[1][0]), true);

  for (const [id, subject] of TILES) {
    await makeImage(`${STYLE} ${subject}`, join(tileDir, `${id}.png`), true);
  }

  if (hasKey('ELEVENLABS_API_KEY')) {
    for (const [file, prompt, duration] of SFX) {
      await elevenSfx(prompt, duration, join(audioDir, file));
    }
    await elevenAmbience(join(audioDir, 'ambience.mp3'));
  } else {
    console.log('skip audio (ELEVENLABS_API_KEY empty)');
  }

  console.log('done');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
