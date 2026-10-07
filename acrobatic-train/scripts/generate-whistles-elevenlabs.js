#!/usr/bin/env node
/**
 * ElevenLabs Sound Generation Pipeline for Acrobatic Train 3D
 * Generates authentic, high-definition train whistle and horn sound effects
 * using the ElevenLabs Sound Effects API (v1/sound-generation).
 *
 * Rules:
 * - Reads ELEVENLABS_API_KEY strictly from environment / .env (zero hardcoded secrets).
 * - Stores output audio as optimized MP3 files in assets/audio/.
 */

import fs from 'node:fs';
import path from 'node:path';

// Parse .env if not loaded in process.env
function getApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/ELEVENLABS_API_KEY\s*=\s*([^\r\n]+)/);
    if (match && match[1].trim() && !match[1].includes('your_')) {
      return match[1].trim();
    }
  }
  return null;
}

const WHISTLE_DEFINITIONS = [
  {
    filename: 'whistle-steam.mp3',
    trainType: 'steam',
    text: 'Authentic vintage steam locomotive train whistle blow, loud high-pressure steam blast echoing across the railway valley with rich harmonic resonance and trailing steam hiss',
    duration_seconds: 2.5,
    prompt_influence: 0.85
  },
  {
    filename: 'horn-cyber.mp3',
    trainType: 'cyber / default',
    text: 'High-speed electric bullet train pneumatic air horn blast, crisp sharp modern tone with clean outdoor Doppler echo',
    duration_seconds: 1.8,
    prompt_influence: 0.85
  },
  {
    filename: 'horn-british.mp3',
    trainType: 'british / class395',
    text: 'British high-speed express train two-tone horn chime doo-daa, loud two-pitch railway signal horn with atmospheric echo',
    duration_seconds: 1.8,
    prompt_influence: 0.85
  },
  {
    filename: 'horn-diesel.mp3',
    trainType: 'diesel / freight',
    text: 'Heavy freight train diesel locomotive Nathan K5LA 5-chime horn blast, powerful deep resonant harmonic chord echoing along canyon tracks',
    duration_seconds: 2.2,
    prompt_influence: 0.85
  }
];

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ ERRO: ELEVENLABS_API_KEY não encontrada no ambiente nem no arquivo .env');
    console.error('Adicione sua chave no arquivo .env: ELEVENLABS_API_KEY=sua_chave_aqui');
    process.exit(1);
  }

  const outputDir = path.resolve(process.cwd(), 'assets', 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚄 [ElevenLabs Audio Pipeline] Gerando apitos de trem realistas em alta definição...\n');

  for (const item of WHISTLE_DEFINITIONS) {
    const targetFile = path.join(outputDir, item.filename);
    console.log(`🎙️  Gerando apito para [${item.trainType}]: ${item.filename}...`);

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: item.text,
          duration_seconds: item.duration_seconds,
          prompt_influence: item.prompt_influence
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Falha ao gerar ${item.filename} (Status ${response.status}):`, errorText);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(targetFile, buffer);
      console.log(`✅ Salvo: ${item.filename} (${(buffer.length / 1024).toFixed(1)} KB) em assets/audio/`);
    } catch (err) {
      console.error(`❌ Erro de conexão ao gerar ${item.filename}:`, err.message);
    }
  }

  console.log('\n✨ Pipeline ElevenLabs concluído com sucesso!');
}

main().catch((err) => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
