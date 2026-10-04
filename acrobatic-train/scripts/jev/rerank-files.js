#!/usr/bin/env node
/**
 * Fast File Search & Reranking powered by TypeSafe Jev
 * Replaces expensive exploratory subagents by taking a candidate list of files
 * and using Jev's Choice probability distribution to rank the top 2-5 files in ~1.5s.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { askJev, choice } from './client.js';

async function main() {
  const args = process.argv.slice(2);
  let task = '';
  let candidates = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      task = args[++i];
    } else if (args[i] === '--files' && args[i + 1]) {
      candidates = args[++i].split(',').map((f) => f.trim());
    }
  }

  if (!task) {
    task = 'Implement centrifugal force and loop-the-loop physics for train cars on 3D acrobatic rails';
    console.log(`ℹ️ No --task specified. Using demo task: "${task}"`);
  }

  if (!candidates.length) {
    try {
      const gitFiles = execSync('git ls-files', { encoding: 'utf8' })
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f && !f.startsWith('.') && !f.includes('node_modules'));
      candidates = gitFiles;
    } catch {
      // Fallback
    }
  }

  if (!candidates.length) {
    // Default candidate list representing the project structure
    candidates = [
      'src/core/game-loop.js',
      'src/core/state-manager.js',
      'src/scene/camera.js',
      'src/scene/lights.js',
      'src/entities/train.js',
      'src/entities/track-spline.js',
      'src/physics/train-dynamics.js',
      'src/physics/collision-sat.js',
      'src/audio/sound-engine.js',
      'src/ui/hud-speedometer.js',
      'tests/physics.test.js',
      'tests/train.test.js',
      'package.json',
      'AGENTS.md'
    ];
  }

  console.log(`\n⚡ [Jev Reranker] Evaluating ${candidates.length} candidate files for task:\n   "${task}"...\n`);

  // Build criteria map for Choice question
  const criteria = {};
  for (const file of candidates) {
    criteria[file] = `Source file or module: ${file}`;
  }

  const state = {
    development_task: task,
    candidate_files: candidates,
  };

  const questions = {
    most_relevant_file: choice(
      "Which file in `candidate_files` is the single most critical and relevant file to inspect or edit to accomplish `development_task`?",
      criteria
    ),
    secondary_relevant_file: choice(
      "Which secondary file is also directly relevant to accomplishing `development_task`?",
      criteria
    )
  };

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const { most_relevant_file, secondary_relevant_file } = response.answers;

    console.log(`🎯 Reranking completed in ${elapsed}s (Model: ${response.model})\n`);

    // Sort candidates by highest probability
    const probs = most_relevant_file.probabilities || {};
    const ranked = Object.entries(probs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    console.log('Top Ranked Files to Open:');
    console.log('------------------------------------------------------------');
    ranked.forEach(([file, prob], index) => {
      const isTop = index === 0 ? ' ⭐ (PRIMARY)' : '';
      console.log(` ${index + 1}. ${file.padEnd(35)} [${(prob * 100).toFixed(1)}%]${isTop}`);
    });
    console.log('------------------------------------------------------------');
    console.log(`\n💡 Recommendation for Coding Agent: Open only the top 2-3 files above.`);
    console.log(`   Top pick confidence: ${((most_relevant_file.confidence || 0) * 100).toFixed(0)}%\n`);

    return ranked.map(([f]) => f);
  } catch (err) {
    console.error(`❌ [Jev Reranker Error]:`, err.message);
    return candidates.slice(0, 3);
  }
}

if (process.argv[1] && import.meta.url.endsWith('rerank-files.js')) {
  main();
}

export { main as rerankFiles };
