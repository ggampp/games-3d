#!/usr/bin/env node
/**
 * Fast Context Compaction Triage powered by TypeSafe Jev
 * Evaluates conversation / transcript turns to determine in < 1s what is
 * critical state to retain (decisions, unresolved requirements) versus
 * discardable noise (raw tool stdout, superseded scratchpad notes).
 */

import { askJev, choice, noul, score } from './client.js';

async function main() {
  const sampleTurns = [
    { id: 'turn_1', type: 'user_req', summary: 'Build 3D acrobatic train game using Three.js with loop-the-loop track.' },
    { id: 'turn_2', type: 'tool_output', summary: 'npm install stdout: 420 lines of package auditing logs.' },
    { id: 'turn_3', type: 'architecture_decision', summary: 'Decided to keep physics updates decoupled from DOM to avoid 60fps frame drops.' },
    { id: 'turn_4', type: 'scratchpad_failure', summary: 'Tried naive Euler integration, caused numerical explosion on tight curves.' },
    { id: 'turn_5', type: 'architecture_decision', summary: 'Switched to Verlet integration with fixed 120Hz substepping for stable acrobatics.' },
    { id: 'turn_6', type: 'tool_output', summary: 'git status stdout showing untracked temp files.' },
    { id: 'turn_7', type: 'pending_task', summary: 'Still need to implement sound engine for train screech on loops.' }
  ];

  console.log(`\n🧹 [Jev Context Compactor] Triaging ${sampleTurns.length} conversation items for fast compaction...\n`);

  const state = {
    conversation_turns: sampleTurns,
  };

  const questions = {};
  for (const t of sampleTurns) {
    questions[`retain_${t.id}`] = noul(
      `Is it critical to retain the content of turn \`${t.id}\` ("${t.summary}") in the compacted long-term memory?`,
      {
        "true": "Essential architecture decision, user requirement, or pending task",
        "false": "Disposable stdout, superseded scratchpad mistake, or transient status"
      }
    );
  }

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const answers = response.answers;

    console.log(`⏱️ Triaged in ${elapsed}s (Model: ${response.model})\n`);
    console.log('Context Retention Decisions:');
    console.log('------------------------------------------------------------');

    const retained = [];
    const discarded = [];

    for (const t of sampleTurns) {
      const qKey = `retain_${t.id}`;
      const prob = answers[qKey]?.noul ?? 0;
      const keep = prob >= 0.50;
      const icon = keep ? '💾 KEEP' : '🗑️ DROP';
      console.log(`${icon} [${(prob * 100).toFixed(0)}%] ${t.id.padEnd(8)}: ${t.summary.slice(0, 50)}...`);
      if (keep) retained.push(t);
      else discarded.push(t);
    }

    console.log('------------------------------------------------------------');
    console.log(`📊 Compression Results: Kept ${retained.length} / ${sampleTurns.length} turns (${((1 - retained.length / sampleTurns.length) * 100).toFixed(0)}% context token savings).`);
    console.log(`⚡ Finished without launching a slow, expensive full-LLM summarizer!\n`);

    return { retained, discarded };
  } catch (err) {
    console.error(`❌ [Jev Context Compactor Error]:`, err.message);
    return null;
  }
}

if (process.argv[1] && import.meta.url.endsWith('compact-context.js')) {
  main();
}

export { main as compactContext };
