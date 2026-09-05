# Pequeno Reino

Jogo calmo de cartas e hexágonos em Three.js. Cada carta é um pedaço de chão, um telhado ou um aldeão. Pose hexágonos vizinhos, forme cadeias (roça → engenho → padaria), equilibre Natureza, Povo e Água e cumpra as missões de cada estação.

## Rodar

```bash
npm install
npm run dev        # http://127.0.0.1:5188
npm run build      # tsc + vite build → dist/
npm run preview
```

## Testes

```bash
npm test               # unitários (vitest): hex, produção, sessão, economia, save
npm run test:e2e       # Playwright: tela inicial + uma fase inteira (desktop e mobile)
node scripts/shot.mjs  # capturas de todas as telas em artifacts/shots (dev server no ar)
```

## Como se joga

- **Mão de 3 cartas** em leque, teclas `1` `2` `3` ou `Tab` selecionam. Toque num hex claro ao lado do reino para posar.
- **Câmera**: arrastar gira, botão direito (ou dois dedos) move o mapa, roda/pinça/`+` `-` dão zoom, `WASD`/setas movem, `Q` `E` giram, `R` ou duplo clique recentra.
- **Prévia**: passe o mouse sobre um hex vago para ver o que a carta rende ali.
- **Moedas**: pão vale 2, farinha/madeira/peixe/pedra valem 1. Um pacote novo custa 2 moedas (`P`).
- **Descartar** (`X`, 3 por fase) e **Desfazer** (`Z`, a última jogada).
- **Missões cumpridas** não encerram a fase: continue somando pontos ou clique em *Encerrar a fase*.
- **Pontos** = Natureza + Povo + Água + 2 × (a menor das três) + população. Estrelas por fase conforme o tamanho do baralho.
- Cada fase concluída **desbloqueia um tile** que entra de fato nos baralhos seguintes. A fase 5 é sandbox com semente exibida no HUD.

## Estrutura

```
src/game/      regras puras (hex, sessão, produção, missões, economia, tutorial)
src/render/    Three.js: tiles procedurais, modelos GLB, nuvens, partículas
src/ui/        HUD em HTML
src/audio/     SFX, trilha por estação, narração
src/data/      tiles, fases e missões (pt-BR)
public/        arte, áudio, modelos gerados, manifest PWA
scripts/       geração de assets e capturas
```

## Assets gerados

Os assets vêm de APIs configuradas no `.env` (veja `.env.example`; nunca comite o `.env`):

```bash
node scripts/generate-assets.mjs         # arte dos tiles (FAL/Gemini) e SFX base (ElevenLabs)
node scripts/generate-assets-extra.mjs   # trilhas, SFX extras, narração, modelos GLB, ícones
node scripts/generate-assets-extra.mjs audio   # só uma categoria: images | audio | models
```

Arquivos já existentes são pulados. Modelos 3D (`public/models/*.glb`) vêm do FAL Trellis a partir da arte dos tiles e podem ser desligados em *Opções → Modelos 3D gerados*.
