#!/usr/bin/env node
/**
 * 7-Question PR Review Gate powered by TypeSafe Jev
 * Evaluates git diffs or proposed PRs across 7 objective safety and quality criteria.
 * Fast-passes clean diffs in < 1.5s, escalates uncertain or risky diffs to senior review.
 */

import { execSync } from 'node:child_process';
import { askJev, noul, score } from './client.js';

async function main() {
  const args = process.argv.slice(2);
  let diffContent = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--diff' && args[i + 1]) {
      diffContent = args[++i];
    }
  }

  // If no diff passed explicitly, retrieve git diff
  if (!diffContent) {
    try {
      diffContent = execSync('git diff HEAD', { encoding: 'utf8' }).trim();
      if (!diffContent) {
        diffContent = execSync('git diff --cached', { encoding: 'utf8' }).trim();
      }
    } catch {
      // Fallback
    }
  }

  // If still empty, use a demo diff for dry run
  if (!diffContent) {
    diffContent = `
diff --git a/src/physics/train.js b/src/physics/train.js
index 1234567..89abcdef 100644
--- a/src/physics/train.js
+++ b/src/physics/train.js
@@ -12,4 +12,6 @@ export class TrainPhysics {
   update(delta) {
+    this.speed += this.acceleration * delta;
+    this.centrifugalForce = (this.speed ** 2) / this.curveRadius;
   }
 }
    `.trim();
    console.log('ℹ️ No active git diff detected. Running demo PR Review Gate on sample diff...');
  }

  console.log(`\n🔍 [PR Review Gate] Running 7-Question System One audit on diff (${diffContent.length} chars)...\n`);

  const state = {
    diff: diffContent,
  };

  const questions = {
    q1_secret_exposure: noul(
      "Does `diff` introduce any hardcoded API keys, secrets, tokens, or private credentials?",
      { "true": "Exposes secrets or tokens", "false": "No secrets found" }
    ),
    q2_scope_drift: noul(
      "Does `diff` alter modules, build files, or configurations completely outside the expected scope?",
      { "true": "Contains out-of-scope drift", "false": "Changes are focused and cohesive" }
    ),
    q3_breaking_api_change: noul(
      "Does `diff` delete or alter existing public function signatures, breaking backwards compatibility?",
      { "true": "Breaks existing public APIs", "false": "Preserves API compatibility" }
    ),
    q4_unhandled_edge_cases: noul(
      "Does `diff` remove critical safety checks, null validations, or error boundaries?",
      { "true": "Removes error handling", "false": "Maintains or improves error handling" }
    ),
    q5_security_antipattern: noul(
      "Does `diff` introduce security risks such as unsafe eval, prototype pollution, or memory leaks?",
      { "true": "Contains security antipatterns", "false": "Safe and sound" }
    ),
    q6_test_deletion: noul(
      "Does `diff` delete, disable, or comment out existing automated tests?",
      { "true": "Deletes or disables tests", "false": "Tests untouched or expanded" }
    ),
    q7_undocumented_behavior: noul(
      "Does `diff` introduce major architectural changes without necessary code comments or documentation?",
      { "true": "Major undocumented changes", "false": "Self-documenting or documented" }
    ),
    overall_risk: score(
      "Rate the overall risk of merging this diff into production.",
      [
        "Level 0: Negligible risk (Fast-pass)",
        "Level 1: Moderate risk (Requires human or senior LLM second glance)",
        "Level 2: High risk (Block and revise)"
      ]
    )
  };

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const answers = response.answers;

    console.log(`⏱️ Audit completed in ${elapsed}s via ${response.model}\n`);
    console.log('Result Breakdown:');
    console.log('------------------------------------------------------------');

    const checks = [
      { id: 'q1_secret_exposure', label: '1. Secret / Credential Exposure' },
      { id: 'q2_scope_drift', label: '2. Unwarranted Scope Drift' },
      { id: 'q3_breaking_api_change', label: '3. Breaking API Signatures' },
      { id: 'q4_unhandled_edge_cases', label: '4. Removed Error / Boundary Checks' },
      { id: 'q5_security_antipattern', label: '5. Security / Memory Antipatterns' },
      { id: 'q6_test_deletion', label: '6. Test Deletion or Disabling' },
      { id: 'q7_undocumented_behavior', label: '7. Undocumented Architectural Shift' },
    ];

    let hasRedFlags = false;

    for (const check of checks) {
      const res = answers[check.id];
      const prob = res.noul;
      const statusIcon = prob > 0.40 ? '⚠️' : '✅';
      if (prob > 0.40) hasRedFlags = true;
      console.log(`${statusIcon} ${check.label.padEnd(42)}: ${(prob * 100).toFixed(1)}% prob`);
    }

    const overallScore = answers.overall_risk?.score ?? 0;
    console.log('------------------------------------------------------------');
    console.log(`📊 Overall Risk Score: ${overallScore.toFixed(2)} / 2.00 (Confidence: ${((answers.overall_risk?.confidence || 0) * 100).toFixed(0)}%)`);

    if (!hasRedFlags && overallScore < 0.6) {
      console.log(`\n🚀 [FAST-PASS APPROVED] Diff passed all 7 objective gates. Fast merge eligible!\n`);
      return true;
    } else {
      console.log(`\n🛑 [ESCALATE TO SENIOR REVIEW] Flags detected or risk > threshold. Escalating to detailed LLM / human audit.\n`);
      return false;
    }
  } catch (err) {
    console.error(`❌ [PR Review Gate Error]:`, err.message);
    process.exitCode = 1;
    return false;
  }
}

if (process.argv[1] && import.meta.url.endsWith('pr-review-gate.js')) {
  main();
}

export { main as checkPrReviewGate };
