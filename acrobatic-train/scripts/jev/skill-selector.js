#!/usr/bin/env node
/**
 * Instant Skill Selection Hook powered by TypeSafe Jev
 * Evaluates the user's intent or agent turn against installed skill definitions in < 1s,
 * preventing context pollution and unnecessary LLM token bloat.
 */

import { askJev, choice } from './client.js';

const AVAILABLE_SKILLS = {
  'gameforge-threejs': 'Three.js 3D game engine, scene graphs, shaders, lighting, PBR materials, cameras, and WebGL rendering',
  'typesafe-ai': 'TypeSafe System One decision models (Jev), structured evaluation, Choice, Noul, Score, confidence thresholds',
  'gameforge-gameplay': 'Gameplay mechanics, physics loops, input handling, coyote time, screen shake, momentum, acrobatic train tricks',
  'gameforge-audio': 'Web Audio API procedural sound generation, SFX, audio buses, train engine rumble, whistles, and dynamic tracks',
  'ui-ux-pro-max': 'Rich visual HUD, glassmorphism, responsive game controls, score multipliers, typography, and speedometers',
  'gameforge-qa': 'Automated game testing, Playwright headless canvas inspection, FPS performance profiling, visual regression',
  'none': 'General programming or non-specialized task not requiring any specialized game dev skill'
};

async function main() {
  const args = process.argv.slice(2);
  let prompt = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[++i];
    }
  }

  if (!prompt) {
    prompt = 'Add realistic steam engine chuffing sound and rail screeching effects that scale with train velocity';
    console.log(`ℹ️ No --prompt specified. Using demo prompt: "${prompt}"`);
  }

  console.log(`\n🎯 [Jev Skill Selector] Selecting optimal skill for prompt:\n   "${prompt}"...\n`);

  const state = {
    user_prompt: prompt,
  };

  const questions = {
    selected_skill: choice(
      "Which specialized skill in `criteria` is best suited to handle `user_prompt`? Pick `none` if no specialized skill is required.",
      AVAILABLE_SKILLS
    )
  };

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const { selected_skill } = response.answers;

    console.log(`⏱️ Evaluated in ${elapsed}s (Model: ${response.model})\n`);
    console.log('Skill Selection Distribution:');
    console.log('------------------------------------------------------------');

    const probs = selected_skill.probabilities || {};
    const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);

    sorted.forEach(([skill, prob], index) => {
      const isPick = skill === selected_skill.choice ? ' 👈 [SELECTED]' : '';
      console.log(` ${index + 1}. ${skill.padEnd(22)}: ${(prob * 100).toFixed(1)}%${isPick}`);
    });

    console.log('------------------------------------------------------------');
    console.log(`🏆 Active Skill Chosen: ${selected_skill.choice} (Confidence: ${((selected_skill.confidence || 0) * 100).toFixed(0)}%)`);

    if (selected_skill.choice !== 'none') {
      console.log(`📖 Recommendation: Load skill instructions for '${selected_skill.choice}'.\n`);
    } else {
      console.log(`💡 Recommendation: Proceed with core generic capabilities without loading extra skill context.\n`);
    }

    return selected_skill.choice;
  } catch (err) {
    console.error(`❌ [Jev Skill Selector Error]:`, err.message);
    return 'none';
  }
}

if (process.argv[1] && import.meta.url.endsWith('skill-selector.js')) {
  main();
}

export { main as selectSkill };
