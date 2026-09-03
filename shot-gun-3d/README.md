# Splinter

Playground FPS de destruição voxel (Three.js + Rapier). Uma vila do velho oeste
inteira em voxels de 8 cm: saloon, capela com sino, caixa d'água, moinho que
gira, banco com cofre, estábulo, loja, cadeia, torre de vigia, vagão nos trilhos.
Cinco armas, personagem que anda, corre, pula e agacha, física de verdade nas
portas, correntes e no que cai.

Planos: [`GAME_PLAN.md`](./GAME_PLAN.md) (origem) e
[`GAMEPLAY_PLAN.md`](./GAMEPLAY_PLAN.md) (v2, movimento + estruturas + voxels
menores).

```bash
npm install && npm run dev
npm test
npm run build
```

## Controles

| Desktop | Toque | Gamepad |
|---|---|---|
| WASD anda · Shift corre · Espaço pula · Ctrl/C agacha | joystick anda · PULO | analógico esq. · A pula · L3 corre · LT agacha |
| mouse mira · clique atira · 1–8 troca arma · R recarrega | arrasta para mirar · FOGO · RECARGA · barra | analógico dir. · RT atira · LB/RB arma · X recarrega |
| E usa (sino, poço, empurrar) · Q ou botão direito detona | USAR · BOOM | Y usa · B detona |
| L hora do dia · P pós-processamento · T modo · Backspace reconstrói · M som · Esc pausa | botões no topo | |

## Armas

1 revólver · 2 escopeta · 3 rifle · 4 dinamite · 5 laser (acende madeira e feno; superaquece) ·
6 canhão de água (apaga fogo; enche no poço com E) · 7 gancho (puxa objetos soltos ou você até a parede) ·
8 detonador (bananas remotas; Q explode tudo).

Munição limitada nas armas 1–4 e 8: caixas douradas espalhadas pela vila repõem 50% e reaparecem.

## Modos

T alterna entre modo livre e cinco contratos (derrubar 3 prédios, tombar a caixa d'água, soltar o sino,
queimar o estábulo, derrubar o moinho) com tempo e recorde local. Alvos de galeria sobem e descem
atrás das cercas e valem 50 pontos; o que cai sem tiro direto (reação em cadeia) vale o dobro.

## Assets gerados

- SFX: `python scripts/generate_assets.py audio` (ElevenLabs sound generation, `ELEVENLABS_API_KEY`).
- Texturas: `python scripts/generate_assets.py textures` (Fal `flux/schnell`, `FAL_KEY`); o script dobra em espelho para ficarem contínuas.
- Viewmodels GLB: `python scripts/generate_weapons_fal.py` (Fal Tripo), incluindo canhão de água, gancho e detonador.

O runtime só lê arquivos locais em `public/assets/`; sem chave nenhuma o jogo
roda com texturas procedurais e sem os sons novos.
