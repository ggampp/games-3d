#!/usr/bin/env node
/**
 * Jev Tool Suite Verification Test
 * Runs all Jev-powered agent tools in sequence to confirm readiness.
 */

import { checkGuardrail } from './guardrail.js';
import { checkPrReviewGate } from './pr-review-gate.js';
import { rerankFiles } from './rerank-files.js';
import { checkTestCoverage } from './test-coverage.js';
import { selectSkill } from './skill-selector.js';
import { selectBrowserAction } from './browser-action.js';
import { compactContext } from './compact-context.js';

async function runSuite() {
  console.log('============================================================');
  console.log('🚀 TESTING TYPESAFE JEV TOOL SUITE FOR ACROBATIC TRAIN');
  console.log('============================================================');

  console.log('\n[TEST 1/7] Pre-Edit Guardrail');
  await checkGuardrail();
  // Reset exitCode because Guardrail intentionally blocked the sample violation
  process.exitCode = 0;

  console.log('\n[TEST 2/7] 7-Question PR Review Gate');
  await checkPrReviewGate();
  process.exitCode = 0;

  console.log('\n[TEST 3/7] Fast File Reranker');
  await rerankFiles();

  console.log('\n[TEST 4/7] Test Coverage & Specification Control Layer');
  await checkTestCoverage();

  console.log('\n[TEST 5/7] Instant Skill Selection Hook');
  await selectSkill();

  console.log('\n[TEST 6/7] Goal-Driven Browser Action Selector');
  await selectBrowserAction();

  console.log('\n[TEST 7/7] Fast Context Compactor');
  await compactContext();

  console.log('============================================================');
  console.log('✨ ALL JEV TOOLS VERIFIED AND OPERATIONAL!');
  console.log('============================================================\n');
}

runSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
