# games-3d

Exemplos de jogos **3D** no browser (Three.js / WebGL, câmera perspectiva).

Cada pasta é um projeto independente. Instale e rode **dentro** dela.

| Pasta | Loop | Como rodar |
|---|---|---|
| [`canyon-rails/`](./canyon-rails) | Assentar trilhos + trem | `npm install && npm run dev` |
| [`flight-simulator/`](./flight-simulator) | Skywatch — voo 3D | `npm install && npm run dev` |
| [`living-medieval-town/`](./living-medieval-town) | Stagsmere — cidade medieval | servir a pasta (`npx serve .`) |
| [`shot-gun-3d/`](./shot-gun-3d) | Splinter — FPS voxel / destruição | `npm install && npm run dev` |
| [`rubik-cube/`](./rubik-cube) | Cubo mágico 3D | `npm install && npm run dev` |
| [`prisma/`](./prisma) | Puzzle diário de luz e espelhos | `npm install && npm run dev` |
| [`pequeno-reino/`](./pequeno-reino) | Diorama de reino | `npm install && npm run dev` |
| [`night-sortie/`](./night-sortie) | Night Sortie — F-35A, corrida aérea noturna + dogfight | `npm install && npm run dev` |
| [`neon-ridge-drift/`](./neon-ridge-drift) | Neon Ridge Drift — drift neon (demo threejs-game-skills) | servir a pasta (`npx serve .`) |
| [`championship-snooker-arena/`](./championship-snooker-arena) | Championship Snooker Arena — sinuca 9-ball (demo threejs-game-skills) | servir a pasta (`npx serve .`) |
| [`starship-dogfight/`](./starship-dogfight) | Starship Dogfight — dogfight espacial (demo threejs-game-skills) | servir a pasta (`npx serve .`) |
| [`tide-singer/`](./tide-singer) | Tide Singer — exploração submarina (demo threejs-game-skills) | servir a pasta (`npx serve .`) |
| [`ripcore/`](./ripcore) | Ripcore — arena battler de piões (demo threejs-game-skills) | servir a pasta (`npx serve .`) |
| [`nieve/`](./nieve) | NIEVE — survival horror em Buenos Aires nevada (reimplementação de nieve.emaalozada.com) | `npm install && npm run dev` |

Remote previsto: `git@github-pessoal:ggampp/games-3d.git`

As cinco demos `threejs-game-skills` são builds publicados (Netlify) copiados em 2026-09-05; ver o README de cada pasta.

## Game Design Documents

As cinco demos copiadas têm um `GDD.md` (8 seções, framework MDA) documentando o design
observado no build publicado: como não há código-fonte (só bundle minificado), jogabilidade,
fases e modelos dessas demos não foram alterados. Nos jogos com código-fonte o design vive no
`README.md` e, quando existe, no `GAME_PLAN.md` de cada pasta.

Origens Git anteriores: [`ORIGINS.md`](./ORIGINS.md).
