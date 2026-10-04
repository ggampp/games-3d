#!/usr/bin/env node
/**
 * Pre-Edit Guardrail powered by TypeSafe Jev
 * Intercepts code modifications and verifies compliance against AGENTS.md rules.
 * If confidence in a violation exceeds the safety threshold, blocks execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { askJev, noul, choice, score } from './client.js';

async function main() {
  const args = process.argv.slice(2);
  let targetFile = '';
  let contentToCheck = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      targetFile = args[++i];
    } else if (args[i] === '--diff' && args[i + 1]) {
      contentToCheck = args[++i];
    }
  }

  // If no direct args, check if there's staged git diff or stdin
  if (!contentToCheck) {
    if (targetFile && fs.existsSync(targetFile)) {
      contentToCheck = fs.readFileSync(targetFile, 'utf8');
    } else {
      // Sample test content for demonstration if invoked directly
      contentToCheck = `
        // Example check: train physics update
        function updatePhysics(dt) {
          train.position.x += velocity * dt;
          document.getElementById('speed').innerText = velocity; // potential rule violation!
        }
      `;
      targetFile = targetFile || 'src/physics/train.js';
      console.log('ℹ️ No file/diff provided. Running demo verification on sample code...');
    }
  }

  // Load project rules from AGENTS.md
  const agentsPath = path.resolve(process.cwd(), 'AGENTS.md');
  const rules = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : 'Follow standard clean architecture.';

  const state = {
    target_file: targetFile,
    proposed_content_or_diff: contentToCheck,
    project_rules: rules,
  };

  const questions = {
    rule_violation: noul(
      "Does `proposed_content_or_diff` violate any architectural, security, or design rule in `project_rules`?",
      {
        "true": "Violates one or more documented rules (e.g. secret leaks, DOM in physics loop, leak of WebGL resources)",
        "false": "Complies with all documented project architecture and security rules"
      }
    ),
    violation_category: choice(
      "If there is a violation or concern in `proposed_content_or_diff`, which rule category is it?",
      {
        "none": "No violation detected; compliant",
        "secret_or_credential_leak": "Hardcoded API keys, tokens, or credentials",
        "dom_in_physics_loop": "Direct DOM mutations or layout thrashing inside 60fps render/physics loops",
        "leaked_webgl_resources": "Geometries/materials created without lifecycle cleanup",
        "unauthorized_git_push": "Automated git push or unconfirmed branch mutations",
        "architecture_bypass": "Skipping modular structure or bypassing established boundaries"
      }
    ),
    severity: score(
      "Rate the violation severity in `proposed_content_or_diff` against `project_rules`.",
      [
        "Level 0: Clean / No violation",
        "Level 1: Minor stylistic notice or non-critical smell",
        "Level 2: Critical blocking violation of safety/architecture rule"
      ]
    )
  };

  console.log(`\n🛡️ [Jev Guardrail] Inspecting ${targetFile}...`);

  try {
    const response = await askJev(state, questions);
    const { rule_violation, violation_category, severity } = response.answers;

    console.log('----------------------------------------------------');
    console.log(`Violation Probability (Noul): ${(rule_violation.noul * 100).toFixed(1)}%`);
    console.log(`Detected Category (Choice):  ${violation_category.choice} (Confidence: ${((violation_category.confidence || 0) * 100).toFixed(0)}%)`);
    console.log(`Severity Score:              ${severity.score?.toFixed(2) || '0.00'}`);
    console.log('----------------------------------------------------');

    if (rule_violation.noul >= 0.80 || (violation_category.choice !== 'none' && (violation_category.confidence || 0) >= 0.75)) {
      console.error(`\n❌ [GUARDRAIL BLOCKED] Jev detected a likely architecture/security violation!`);
      console.error(`Reason: Category "${violation_category.choice}".`);
      console.error(`Please adjust your code to satisfy the guidelines in AGENTS.md before continuing.\n`);
      process.exitCode = 1;
      return false;
    } else {
      console.log(`\n✅ [GUARDRAIL PASSED] Changes adhere to project architecture rules.\n`);
      return true;
    }
  } catch (err) {
    console.error(`❌ [Jev Guardrail Error]:`, err.message);
    process.exitCode = 1;
    return false;
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}

export { main as checkGuardrail };
