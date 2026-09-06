# Tide Singer — GDD

> Versão 1.0 · 2026-09-06 · equipe games-3d · status: **documentação de build publicado**
> (engenharia reversa do bundle; não há código-fonte local — ver seção 7).

## 1. Visão geral
Odisseia de um golfinho por cinco mares: encontrar os três cristais de canção em cada mar,
respirar na superfície ou em bolsões de ar, evitar predadores e, no final, cantar as três canções
para o Portão. Gênero: exploração/aventura 3D subaquática. Plataforma: browser (Three.js).
Público: todas as idades; 20–40 minutos para a campanha.

## 2. Pilares de design
- **Fôlego como tensão**: ar acaba; superfície e bolsões são o ritmo do nível.
- **A canção é luz e ferramenta**: sonar revela cristais e afasta caçadores.
- **Mar como personagem**: cada mar tem regra própria (correnteza, escuridão, caverna).
- O que NÃO é: combate direto; o golfinho não ataca, apenas canta e foge.

## 3. Mecânicas (M)
| Ação | Entrada |
|---|---|
| Nadar | WASD |
| Sonar (canção) | Espaço / botão |
| Carga (dash) | Shift / botão |
| Pausa · som | botão · SOUND |

Medidores: HP e AIR; upgrades "DEEP LUNGS" (mais fôlego) e "TIDE VIGOR" (vitalidade extra).
Objetivo por mar: 3 cristais; portão final exige as três canções. Derrota: sem ar ou HP 0
("THE SEA TAKES YOU BACK") com reinício do mar.

## 4. Dinâmicas (D)
Mares (LEVEL SELECT, desbloqueio sequencial):

| Mar | Regra nova | Aviso do jogo |
|---|---|---|
| Sunlit Shallows | aprender a cantar e respirar | "learn the song of the tide" |
| Kelp Forest | correnteza e águas-vivas | "ride the drift, mind the stingers" |
| The Trench | escuridão, downdraft, caçadores | "beware the downdraft and the hunters" |
| Abyss Cavern | sem céu; ar em bolsões; canção ilumina | "your song is your light" |
| Song Gate (final) | cantar as três canções ao portão | "sing to the gate, far east" |

Eventos: tubarão caçador que "foge, vencido" após sonar; baleia ("something vast passes below").

## 5. Estética (E)
Arte-chave pintada (título com golfinho e cristais), cáusticas, areia e rocha com normal maps,
cardumes, kelp; bloom subaquático. Áudio: 14 SFX (sonar, respiro, comer, dano, cristal, portão,
carga, tubarão, baleia, concha, UI, superfície, batimento, ambiência) e 3 trilhas
(serene, deep, title).

## 6. Conteúdo & assets
GLB: dolphin, shark, whale, manta, turtle, fish-blue/gold/orange, coral-a/b, boulder-a/b,
spire, gate. Imagens: caustics, rock2(+normal), sand2(+normal), key art (paisagem e retrato).

## 7. Técnico
Build Vite, bundle ~722 kB. Rodar: `npx serve .`. Sem fonte nem testes. Melhorias exigiriam
recriação com código próprio.

## 8. Roadmap & estado
Pronto: build idêntico ao publicado. Backlog para recriação: sexto mar (naufrágio), modo
contra-relógio por mar, cardumes reativos ao sonar, álbum de criaturas encontradas.
