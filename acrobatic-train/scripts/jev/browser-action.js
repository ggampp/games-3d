#!/usr/bin/env node
/**
 * Goal-Driven Browser Action Selector powered by TypeSafe Jev
 * For Browser Subagents, Playwright, or E2E Testing:
 * Given a high-level test objective and a list of interactive elements,
 * selects the exact next element to click in milliseconds without passing
 * full DOM trees or screenshots through expensive multimodal LLMs.
 */

import { askJev, choice, noul } from './client.js';

async function main() {
  const args = process.argv.slice(2);
  let goal = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--goal' && args[i + 1]) {
      goal = args[++i];
    }
  }

  if (!goal) {
    goal = 'Start the game in Hardcore Mode, customize locomotive to Crimson Bullet, and launch train';
    console.log(`ℹ️ No --goal specified. Using demo test goal: "${goal}"`);
  }

  // Interactive elements extracted from page DOM
  const interactiveElements = [
    { id: 'btn-start-game', label: 'Start Game (Menu)', type: 'button' },
    { id: 'btn-mode-easy', label: 'Mode: Scenic Route', type: 'button' },
    { id: 'btn-mode-hardcore', label: 'Mode: Hardcore Acrobatic', type: 'button' },
    { id: 'select-train-skin', label: 'Train Skin Selector (Crimson Bullet)', type: 'select' },
    { id: 'btn-launch-train', label: 'Launch Train on Rails', type: 'button' },
    { id: 'btn-audio-mute', label: 'Mute Audio', type: 'button' },
    { id: 'btn-credits', label: 'View Credits', type: 'button' }
  ];

  // Current session step state
  const stepHistory = [
    'Clicked "btn-start-game"',
    'Clicked "btn-mode-hardcore"',
    'Selected "Crimson Bullet" on "select-train-skin"'
  ];

  console.log(`\n🌐 [Jev Browser Action Selector] Processing next action for goal:\n   "${goal}"...\n`);
  console.log(`Current Step History: ${stepHistory.join(' -> ')}`);

  const criteria = {};
  for (const el of interactiveElements) {
    criteria[el.id] = `[${el.type}] "${el.label}"`;
  }
  criteria['goal_completed'] = 'All parts of the goal are finished; no more clicks needed';
  criteria['blocked_or_error'] = 'Goal cannot proceed or required element is missing';

  const state = {
    test_objective: goal,
    previous_steps: stepHistory,
    available_dom_elements: interactiveElements
  };

  const questions = {
    next_action: choice(
      "Based on `test_objective` and `previous_steps`, which element in `criteria` should be clicked next to advance toward completing the goal?",
      criteria
    ),
    is_completed: noul(
      "Has `test_objective` already been completely achieved based on `previous_steps`?",
      { "true": "Goal is completely fulfilled", "false": "Further action still needed" }
    )
  };

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const { next_action, is_completed } = response.answers;

    console.log(`\n⏱️ Decision made in ${elapsed}s (Model: ${response.model})\n`);
    console.log('------------------------------------------------------------');
    console.log(`🎯 Next Element to Click: ${next_action.choice}`);
    console.log(`📊 Choice Confidence:     ${((next_action.confidence || 0) * 100).toFixed(0)}%`);
    console.log(`🏁 Goal Completed (Noul): ${(is_completed.noul * 100).toFixed(1)}%`);
    console.log('------------------------------------------------------------');

    if (next_action.choice === 'goal_completed' || is_completed.noul >= 0.9) {
      console.log(`🎉 [GOAL REACHED] Test execution sequence complete. Hand off to compliance validator.\n`);
      return { action: 'DONE' };
    } else if (next_action.choice === 'blocked_or_error') {
      console.warn(`⚠️ [BLOCKED] Agent cannot find next step. Escalate to senior model.\n`);
      return { action: 'BLOCKED' };
    } else {
      console.log(`👉 Execute Browser Click: elementId = "${next_action.choice}"\n`);
      return { action: 'CLICK', target: next_action.choice };
    }
  } catch (err) {
    console.error(`❌ [Jev Browser Action Error]:`, err.message);
    return { action: 'ERROR' };
  }
}

if (process.argv[1] && import.meta.url.endsWith('browser-action.js')) {
  main();
}

export { main as selectBrowserAction };
