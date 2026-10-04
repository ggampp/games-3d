# Acrobatic Train (3D) - Architecture & Agent Guidelines

## 1. Project Overview & Stack
- **Game Genre**: 3D Acrobatic Train arcade action game.
- **Tech Stack**:
  - HTML5 Canvas & WebGL.
  - Three.js for 3D scene graph, physically-based rendering (PBR), shaders, and camera management.
  - Vanilla JavaScript (ES modules) & Vanilla CSS for ultra-fast, lightweight loading without bundler bloat.
  - TypeSafe Jev for System One decision-making, fast reranking, guardrails, and test triage.

## 2. Strict Architectural Rules (Jev Guardrails)
1. **Zero Secret Leaks**:
   - Never embed API keys, access tokens, credentials, or private SSH keys in client-side code, scripts, or commit history.
   - All external keys must be read strictly from environment variables (`process.env`).
2. **Modular Three.js Architecture**:
   - Separate concerns into distinct modules:
     - `src/core/`: Game loop, clock, state manager, asset loader.
     - `src/scene/`: Three.js scene, lighting, skybox, fog, render pipeline.
     - `src/entities/`: Train cars, carriages, physics colliders, rails/track procedural spline.
     - `src/physics/`: Acrobatics, momentum, inertia, centrifugal force, loop-the-loop kinematics.
     - `src/audio/`: Web Audio API sound effects (chug, whistle, rail screech, wind rush).
     - `src/ui/`: Minimalist glassmorphic HUD (speedometer, g-force meter, stunt score, multiplier).
3. **No Direct DOM Mutation in Physics Loop**:
   - Physics and Three.js animation loops run at 60+ FPS. DOM updates must be throttled or decoupled via state listeners.
4. **Clean Asset Lifecycle**:
   - Geometries, materials, and textures must be disposed of cleanly when unloading or restarting scenes to prevent WebGL memory leaks.
5. **Git & Commit Rules**:
   - Local Git user must remain `Guilherme Pimentel <ggampp@gmail.com>`.
   - Never run `git push` without explicit user confirmation.

## 3. Jev Decision-Making Roles
- **Pre-Edit Guardrail**: Evaluates proposed file edits before writing to ensure architecture rules 1-5 are never violated.
- **Control Layer**: Scans rules and features in this document and checks if automated tests exist in `tests/`.
- **Reranker**: Ranks files by task relevance in < 1.5s when an agent needs to locate code.
- **PR Review Gate**: Runs 7 objective System One checks against git diffs prior to merge/commit.
- **Browser Action**: Chooses interactive UI elements during automated E2E testing.
