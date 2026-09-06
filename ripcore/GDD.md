# Ripcore — Arena Battler — GDD

> Versão 1.0 · 2026-09-06 · equipe games-3d · status: **documentação de build publicado**
> (engenharia reversa do bundle; não há código-fonte local — ver seção 7).

## 1. Visão geral
Batalha de piões em arena circular: puxe para trás para dar potência, solte para lançar, use
dash e o especial para derrubar o pião adversário (burst) ou esgotá-lo (KO por giro). Gênero:
arena battler / física. Plataforma: browser (Three.js), mouse e toque. Público: casual;
partidas de 1 a 2 minutos.

## 2. Pilares de design
- **Lançamento decide metade**: ângulo e potência do puxão importam.
- **Piões com personalidade**: estatísticas distintas de ataque/defesa/resistência.
- **Show de arena**: jumbotron, plateia, narração e locutor.
- O que NÃO é: coleção com micropagamentos; multiplayer.

## 3. Mecânicas (M)
| Ação | Entrada |
|---|---|
| Mirar e carregar | arrastar (puxar para trás) |
| Lançar | soltar |
| Dash | WASD / setas / toque esquerda-direita |
| Especial | Espaço / botão especial |

Vitória por **BURST FINISH** (derrubar o adversário) ou **KO** (giro do adversário zera); empate
por tempo leva a **SUDDEN DEATH**. Piões: Rookie Drift, Cinder Jack, Ghost Cyclone, Iron Bastion,
Magma Razor, Vandal Prime, Apex Warden e Custom Top (Garage).

## 4. Dinâmicas (D)
- **30 s**: lançar, posicionar com dash, buscar o choque no momento em que o especial carrega.
- **Sessão**: QUICK BATTLE (uma luta) · TOURNAMENT LADDER (escada de adversários com
  "Next Battle") · GARAGE (montar o Custom Top).
- **Fases**: a escada do torneio é a progressão; adversários em ordem crescente de força.

## 5. Estética (E)
Arena escura com anéis luminosos laranja/azul, plateia de luzes, troféu no topo, logo em chamas;
Orbitron/Rajdhani. Áudio: 28 arquivos (impactos, dash, grind, KO, launch, especial, UI, trilhas
de menu/batalha/vitória e locução: "let it rip", contagem, knockout, survivor, victory, defeat).

## 6. Conteúdo & assets
GLB `models/trophy`. Texturas `metal`, `floor`, `emblem`, `jumbotron` (JPG). Logo PNG. Áudio
em `audio/`.

## 7. Técnico
Build Vite, bundle ~689 kB. Rodar: `npx serve .`. Sem fonte nem testes. Melhorias exigiriam
recriação com código próprio.

## 8. Roadmap & estado
Pronto: build idêntico ao publicado. Backlog para recriação: arenas com perigos (rampas, ímãs),
campanha com 3 ligas, editor de pião com peças que alteram física, replay do golpe final.
