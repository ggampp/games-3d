# Championship Snooker Arena — GDD

> Versão 1.0 · 2026-09-06 · equipe games-3d · status: **documentação de build publicado**
> (engenharia reversa do bundle; não há código-fonte local — ver seção 7).

## 1. Visão geral
Sinuca 9-ball para dois jogadores no mesmo teclado, em uma arena de campeonato com física
própria de passo fixo. Gênero: esporte / bilhar. Plataforma: browser (Three.js). Público: casual
e fãs de bilhar; partida de 5 a 15 minutos.

## 2. Pilares de design
- **Tacada legível**: guia de mira, barra de potência e efeito (spin) sempre à vista.
- **Regras honestas**: faltas reais de 9-ball com bola na mão.
- **Arena com clima**: cordões, iluminação de TV, troféu, placar de racks.
- O que NÃO é: snooker de 15 vermelhas (apesar do nome), online, carreira.

## 3. Mecânicas (M)
| Ação | Entrada |
|---|---|
| Mirar | arrastar com o mouse / toque |
| Carregar e tacar | segurar Espaço ou a barra de potência, soltar para tacar |
| Efeito | pad de spin (canto inferior esquerdo) · Center zera |
| Guia de mira · vista superior · replay · pausa | G · T · V · P/Esc |

Regras: bola da vez é a de menor número; faltas detectadas: sem contato, sem tabela após contato,
bola branca encaçapada (scratch) → bola na mão para o adversário. Rack vence quem encaçapa a 9
legalmente; placar conta racks por jogador.

## 4. Dinâmicas (D)
- **30 s**: escolher bola, alinhar, dosar potência e efeito, observar o resultado.
- **5 min**: um rack; alternância por faltas e erros.
- **Sessão**: melhor de N racks entre dois jogadores locais.
- **Fases**: não há; a progressão é o placar de racks.

## 5. Estética (E)
Mesa com feltro verde (procedural quando a textura falta), madeira nogueira, cordões vermelhos,
arquibancada escura, emblema de arena; fonte Oswald. Câmera atrás do taco com órbita e opção
top-down. Áudio procedural Web Audio: clack, tabela, caçapa, clique de UI.

## 6. Conteúdo & assets
GLB: `cue-rack`, `trophy`. Texturas: `arena-emblem`, `wall-art`, `wood-walnut` (`felt-baize`
ausente também no site original; fallback procedural). Sem arquivos de áudio.

## 7. Técnico
Build Vite, bundle único (~943 kB) + CSS; física própria "custom-billiards (fixed-step)".
Rodar: `npx serve .`. Sem fonte, testes ou package.json. Mesma limitação das outras demos:
melhorias de jogabilidade exigiriam recriar o jogo.

## 8. Roadmap & estado
Pronto: build jogável idêntico ao publicado. Backlog para recriação: IA de adversário com níveis,
modo 8-ball, torneio de 4 mesas, tutorial de efeito, replay com câmera livre.
