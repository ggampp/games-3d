#!/usr/bin/env node
/**
 * Test Coverage & Specification Control Layer powered by TypeSafe Jev
 * Independent audit: compares documented rules/specifications with actual test files
 * to identify untested edge cases and requirements.
 */

import fs from 'node:fs';
import path from 'node:path';
import { askJev, noul, choice } from './client.js';

async function main() {
  const agentsPath = path.resolve(process.cwd(), 'AGENTS.md');
  const specText = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';

  const testDir = path.resolve(process.cwd(), 'tests');
  let testContents = '';
  if (fs.existsSync(testDir)) {
    const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.js') || f.endsWith('.spec.js'));
    for (const tf of testFiles) {
      testContents += `\n--- File: ${tf} ---\n` + fs.readFileSync(path.join(testDir, tf), 'utf8');
    }
  }

  // Key specifications to audit
  const specsToAudit = [
    {
      id: 'spec_centrifugal_loop_physics',
      rule: 'Centrifugal force, momentum, and loop-the-loop kinematics in physics engine',
    },
    {
      id: 'spec_no_dom_in_physics_loop',
      rule: 'Decoupled state updates ensuring no DOM layout thrashing in 60fps loop',
    },
    {
      id: 'spec_webgl_asset_disposal',
      rule: 'Clean disposal of Three.js geometries and materials on scene transitions to prevent memory leaks',
    },
    {
      id: 'spec_secret_protection',
      rule: 'Zero hardcoded secrets, external API keys only accessed through process.env',
    }
  ];

  console.log(`\n📋 [Jev Control Layer] Auditing test coverage against project specifications...`);
  console.log(`   Specs: ${specsToAudit.length} rules | Found Test Suite Length: ${testContents.length} chars\n`);

  const questions = {};
  for (const s of specsToAudit) {
    questions[s.id] = noul(
      `Does \`test_suite_content\` contain an explicit automated test verifying the specification: "${s.rule}"?`,
      {
        "true": "An explicit test exists verifying this exact specification",
        "false": "No test case covers this requirement; untested"
      }
    );
  }

  const state = {
    documentation_specs: specText,
    test_suite_content: testContents || 'No tests implemented yet.',
  };

  try {
    const startTime = Date.now();
    const response = await askJev(state, questions);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const answers = response.answers;

    console.log(`⏱️ Audit finished in ${elapsed}s (Model: ${response.model})\n`);
    console.log('Specification Coverage Audit:');
    console.log('------------------------------------------------------------');

    const missingSpecs = [];

    for (const s of specsToAudit) {
      const res = answers[s.id];
      const prob = res?.noul ?? 0;
      const isCovered = prob >= 0.70;
      const icon = isCovered ? '✅ COVERED' : '❌ MISSING';
      console.log(`${icon} [${(prob * 100).toFixed(0)}%] : ${s.rule}`);
      if (!isCovered) {
        missingSpecs.push(s.rule);
      }
    }

    console.log('------------------------------------------------------------');

    if (missingSpecs.length > 0) {
      console.warn(`\n⚠️ [TEST COVERAGE GAP] ${missingSpecs.length} specification(s) lack automated tests:`);
      missingSpecs.forEach((m, idx) => console.log(`   ${idx + 1}. ${m}`));
      console.log(`\n👉 Action for Coding Agent: Implement test suites under tests/ to satisfy the control layer.\n`);
      return false;
    } else {
      console.log(`\n🎉 [100% SPEC COVERAGE] All documented specifications have verified tests!\n`);
      return true;
    }
  } catch (err) {
    console.error(`❌ [Jev Control Layer Error]:`, err.message);
    return false;
  }
}

if (process.argv[1] && import.meta.url.endsWith('test-coverage.js')) {
  main();
}

export { main as checkTestCoverage };
