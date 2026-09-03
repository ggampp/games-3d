# Splinter — plano de jogabilidade v2

> **Status (2026-09-02): executado.** Fases 0–4 implementadas. Diferenças em
> relação ao planejado: o voxel ficou em **0,08 m** (0,06 m dava ~108 k voxels
> mesmo com paredes finas e interiores ocos; 0,08 m dá ~60 k e roda a ~60 fps
> no desktop). O render usa slots em `InstancedMesh` por material (sem chunk
> meshing). Corpos dinâmicos são culled por esfera envolvente antes do raycast
> e do dano. O vagão anda solto sobre trilhos fixos (sem junta prismática).
>
> **v3 (2026-09-03): visual e jogabilidade.** Render dos estáticos em chunks
> 16³ com faces internas removidas e ambient occlusion por vértice (dinâmicos e
> entulho continuam instanciados); céu procedural com sol, estrelas, nuvens e
> três horários (L); bloom + vinheta (P desliga); faíscas, cacos, fumaça de
> pavio, clarão e marca de queimado; tremor de câmera, hit-stop e recuo.
> Fogo voxel a voxel (`src/game/fire.ts`): laser e dinamite acendem madeira e
> feno, espalha para cima, vira cinza; o canhão de água apaga. Munição, recarga
> e caixas de munição; gancho (puxa objetos soltos ou o jogador); detonador
> remoto; interação E (sino, poço, empurrar); cinco contratos com recorde em
> `localStorage`; reação em cadeia vale o dobro; alvos de galeria cinemáticos;
> gamepad; placa, varal, tumbleweeds ao vento e cercas em arco.
> Voxel 0,06 m foi medido de novo com chunks: 117 k voxels, física de 37 ms no
> início e 24 ms de frame estável — segue em 0,08 m.

Complementa `GAME_PLAN.md`. Três frentes: **movimento real do jogador**,
**mais estruturas para destruir** e **voxels menores** (mais detalhe). A ordem
importa: voxels menores multiplicam o custo de tudo, então a base de
performance (fase 0) vem antes de encolher o bloco.

## Diagnóstico do estado atual

- **Andar já existe, mas só "meio"**: `game.ts` lê WASD e desloca `pos`, porém
  sem colisão (o jogador atravessa pilares, portas e o coreto), sem gravidade,
  sem pulo, e a direção usa o `forward` da câmera com pitch (olhar para o chão
  reduz a velocidade). No celular não há joystick: só olhar e o botão FOGO.
  Na prática a sensação é de "câmera flutuante", não de personagem.
- **Contagem de voxels hoje**: 2 923 blocos de 0,12 m (970 adobe, 1 420 madeira,
  120 prancha, 173 rocha, 45 cacto, ~200 em portas/correntes/lanternas).
- **Gargalos que impedem blocos menores** (todos escalam com N voxels):
  1. `PhysicsSim.rebuild()` destrói e recria **todos** os corpos e colliders a
     cada tiro que remove voxel. Um collider por voxel.
  2. `damageAt()` varre **todos** os voxels da grade por pellet (escopeta = 8
     varreduras).
  3. `VoxelView.sync()` recalcula `poseOf` e reescreve matriz + cor de **todos**
     os voxels a cada frame, alocando um `THREE.Color` por voxel por frame.
  4. `VoxelGrid` usa chave string (`"x,y,z"`) no `Map`, lento para flood-fill
     grande.
  5. `InstancedMesh` com teto fixo de 2 400 instâncias por material.
  6. `isSupported()` usa `iy <= 1` como "toca o deck": depende do tamanho do
     voxel (o deck tem 0,18 m).
- Meta: 0,12 m → **0,06 m** = 8× mais voxels (~23 k). Sem a fase 0 isso não
  roda. Com a fase 0, 0,06 m é viável; 0,08 m (~10 k) é a parada intermediária
  segura.

---

## Fase 0 — Base de performance (pré-requisito)

Objetivo: o custo por tiro e por frame deixa de ser proporcional ao total de
voxels do mundo.

1. **Chave numérica na grade** (`grid.ts`): empacotar `(ix, iy, iz)` em um
   inteiro (offset + shift) e usar `Map<number, Voxel>`. Testes existentes
   continuam valendo.
2. **Dano local** (`connectivity.ts` → `damageAt`): iterar só a caixa de índices
   que cobre o raio (`⌈r / voxelSize⌉` em cada eixo) com `grid.get`. Passa de
   O(N) para O(r³).
3. **Rebuild incremental** (`sim.ts`): ao destruir voxels, recomputar apenas os
   componentes que continham voxels atingidos (BFS a partir dos vizinhos dos
   removidos). Bindings de outras estruturas ficam intactos, com seus corpos e
   juntas. Precisa de `voxelToBinding` → `binding.componentId` e de uma
   `removeBinding(binding)` que também remova as juntas ligadas a ele.
4. **Colliders fundidos para corpos estáticos**: componentes fixos usam
   *greedy merge* de runs de voxels em cuboides (um collider por run em X, depois
   fusão em Y/Z). Reduz o número de colliders ~10×. Corpos dinâmicos pequenos
   (portas, pedaços caídos) continuam com collider por voxel, ou merge simples
   em runs.
5. **Render com sujeira (dirty)** (`voxels.ts`):
   - estáticos: matriz e cor gravadas uma vez quando a grade muda;
   - dinâmicos: por frame só os voxels de bindings dinâmicos são reposicionados
     (matriz = pose do corpo × offset local);
   - tint pré-calculado uma vez por voxel (sem alocar `Color` por frame);
   - capacidade por material dimensionada pelo número real de voxels na planta
     (+ folga), não um `CAP` fixo.
   - **Opcional (fase 3)**: chunks 16³ com *greedy meshing* para os estáticos,
     rebuild só do chunk tocado. Só se o instanced não bastar em 0,06 m.
6. **Suporte independente do tamanho do voxel**: `isSupported` recebe a altura
   do deck em metros e converte para índice (`Math.round(deckTop / voxelSize)`).
7. **Entulho proporcional**: com blocos menores, um tiro de escopeta solta
   dezenas de voxels. Agrupar voxels destruídos vizinhos em pedaços 2×2×2 (um
   corpo com vários colliders) e limitar corpos de entulho por tiro (ex.: 24);
   o excedente vira partículas de poeira sem física (sprite `Points`).

**Aceite**: com a planta atual e voxel 0,06 m (~23 k), um tiro de escopeta
custa < 8 ms no desktop; frame parado < 4 ms de CPU. Testes: chave numérica,
`damageAt` local igual ao antigo em raio pequeno, rebuild incremental não muda
o número de componentes vs. rebuild completo.

---

## Fase 1 — Personagem que anda de verdade

Objetivo: o jogador é um corpo no mundo, colide com estruturas e entulho, sobe
no deck e pode ser bloqueado por uma porta.

1. **Character controller do Rapier** (`src/player/controller.ts`):
   `world.createCharacterController(0.02)` + corpo *kinematicPositionBased* com
   collider cápsula (raio 0,3 m, altura 1,7 m). Configurar `enableAutostep`
   (altura 0,25 m para subir deck e degraus de voxel), `enableSnapToGround`,
   `setMaxSlopeClimbAngle`, `setApplyImpulsesToDynamicBodies(true)` para
   empurrar entulho e portas ao andar.
2. **Movimento**: direção a partir de **yaw só** (achatar `forward` em Y).
   Velocidade 4,6 m/s, corrida com Shift 7 m/s, aceleração/frenagem suave
   (0,1 s) para não parecer teleporte. Gravidade própria (`vy -= 9,81·dt`),
   pulo com Space (impulso ~4,5 m/s, só se `computedGrounded`). Agachar com
   Ctrl (cápsula 1,1 m, olho 0,95 m) para passar sob a viga caída.
3. **Câmera**: `EYE` vira offset a partir da cápsula. Head-bob leve (amplitude
   0,02 m, frequência ligada à velocidade), sway da arma ao virar (já existe
   `viewmodel.update`; alimentar com velocidade angular), *landing dip* ao cair.
4. **Grupos de colisão**: cápsula colide com `COL_WORLD | COL_GROUND | COL_DEBRIS
   | COL_BOMB`, não com `COL_CHAIN` (correntes passam pelo jogador). Portas
   empurradas pelo jogador balançam na dobradiça (já são dinâmicas).
5. **Limites do mundo**: substituir o clamp ±20 m por uma cerca invisível de
   colliders no raio do chão (28 m) e uma cerca de madeira voxel visível no
   perímetro (aproveita a fase 2).
6. **Reset**: `R` reposiciona a cápsula no deck (frente ao saloon), zera
   velocidade.
7. **Mobile**: joystick virtual à esquerda (`hud.ts`, mesmo padrão do botão
   FOGO; `onMove(x, y)`), botão de pulo, e o lado direito da tela continua
   sendo olhar. Detectar `pointer: coarse` para mostrar.
8. **Áudio**: passos em areia/madeira (dois SFX novos via ElevenLabs, no mesmo
   pipeline de `audio.ts`), alternando por material do que está sob o pé
   (raycast curto para baixo: deck/plaza → madeira/pedra, senão areia).

**Aceite**: não atravessa pilar, porta nem coreto; sobe no deck sem pular;
cai do deck; entulho empurrado pelos pés; pulo funciona; celular anda com
joystick. Teste unitário para achatamento de direção e aceleração; o resto é
playtest (`gameforge-qa`).

---

## Fase 2 — Mais estruturas para destruir

Objetivo: uma vila, não um pórtico com enfeites. Cada estrutura é um *prefab*
próprio com um comportamento físico que o diferencia.

### 2.1 Infra de prefabs

- Pasta `src/voxels/structures/` com um builder por estrutura:
  `build(grid, origin, ctx)` onde `ctx` dá `gx()` (metros → índice) e o tamanho
  do voxel. **Tudo em metros**, nunca em índices fixos — é o que permite trocar
  o tamanho do voxel sem reescrever plantas (hoje `saloon.ts` usa índices
  literais e quebraria em 0,06 m).
- Formato de detalhe: mapas ASCII por camada para peças ornamentais (letreiro,
  vitral, janela) + `fillBox`/`fillCylinder`/`fillLine` para o grosso.
- Registro `TOWN` em `src/voxels/town.ts`: lista `{ id, name, origin, rotation,
  build }`. `buildSaloon()` passa a ser `buildTown()`.
- Grupos: `VoxelGroup` vira string livre com prefixo (`door:<id>`,
  `chain:<id>`, `spin:<id>`), em vez do union fixo de 4 correntes/3 portas.
  `sim.ts` cria juntas por prefixo. Lanternas passam a ser N (pool de luzes
  cresce, com culling pelas 6 mais próximas do jogador).
- HUD: integridade **por estrutura** (barra pequena ao mirar nela) + integridade
  geral da vila.

### 2.2 Catálogo de estruturas (ordem sugerida)

| # | Estrutura | O que a torna interessante de destruir |
|---|-----------|----------------------------------------|
| 1 | **Caixa d'água** sobre 4 pernas de madeira | Tanque pesado (adobe/steel) em pernas finas: tirar 2 pernas do mesmo lado tomba o tanque inteiro sobre o que estiver embaixo. Testa o suporte de componentes. |
| 2 | **Capela com campanário** | Torre alta de adobe, sino de bronze pendurado em corrente (reusa o sistema de lanterna/corrente). Sino cai e rola. Vitral de vidro (material novo, frágil, quebra em cascata). |
| 3 | **Moinho de vento** | Pás em junta revolute **com motor** (gira sozinho). Tiro na pá desbalanceia; tirar o eixo solta a roda girando. |
| 4 | **Banco com cofre** | Fachada de tijolo (material novo, médio), cofre de aço só abre com bomba; dentro, barras de ouro (voxels emissivos que valem pontos extra). |
| 5 | **Estábulo** | Fardos de feno (material novo, hp baixo, densidade baixa) já dinâmicos desde o início, empilhados. Escopeta espalha. |
| 6 | **Loja geral com letreiro** | Letreiro de pranchas com letras em ASCII map, pendurado por 2 correntes: quebrar uma corrente deixa o letreiro pendendo. |
| 7 | **Cadeia** | Barras de aço (hp alto) na janela; teste do rifle vs. escopeta. |
| 8 | **Torre de vigia** | Escada de mão com degraus de 1 voxel; plataforma em cima. Jogador pode subir (fase 1). |
| 9 | **Vagão em trilhos** | Corpo dinâmico sobre trilho fixo, com junta prismática; a bomba o empurra. |
| 10 | **Cerca do perímetro** | Postes e tábuas; barata, muitas, boa para dar "textura" de vila. |

Entregar 1–3 primeiro (cada uma introduz uma mecânica nova); 4–10 são
reaproveitamento.

### 2.3 Materiais novos (`types.ts`)

`glass` (hp 2, transparente, som próprio), `brick` (hp 12), `hay` (hp 3,
densidade 0,3), `bronze` (hp 22, densidade 3, som de sino), `gold` (hp 14,
emissivo, pontos ×5). Texturas procedurais em `textures.ts`.

### 2.4 Layout da vila

Rua principal em X (saloon ao centro, como hoje), capela no fim da rua, caixa
d'água e moinho atrás do saloon, banco e loja frente a frente, estábulo e cerca
na borda. Raio útil ~22 m, dentro do chão de 28 m. Sombra do sol (`shadow
camera` ±22 m) já cobre.

**Aceite**: cada estrutura tem teste de contagem/conectividade (constrói, é um
único componente suportado, número de juntas esperado). Tombamento da caixa
d'água reproduzível: remover 2 pernas → componente do tanque fica dinâmico.

---

## Fase 3 — Voxels menores (0,12 m → 0,06 m)

Depois das fases 0 e 2 (plantas em metros), trocar `VOXEL_SIZE` é uma mudança
de uma linha mais ajustes:

1. **Passar por 0,08 m primeiro**; medir com `__THREE_GAME_DIAGNOSTICS__`
   (bodies, colliders) e o profiler do `gameforge-qa`. Só ir a 0,06 m se ficar
   dentro do aceite da fase 0.
2. **Armas rebalanceadas**: `radius` em metros já é independente, mas `damage`
   por voxel precisa cair (hp por voxel menor: escala hp ∝ tamanho do voxel para
   que uma parede de 0,36 m aguente o mesmo número de tiros). Tabela no
   `catalog.ts` + teste "tiros para atravessar 1 parede" fixo.
3. **Detalhe que justifica o bloco pequeno**: chanfros nas pilastras, telhas
   sobrepostas, dobradiças com pino, letras legíveis no letreiro, elos de
   corrente de 2 voxels em L. É aqui que os mapas ASCII da fase 2 rendem.
4. **Entulho**: com 0,06 m, pedaços 2×2×2 (= 0,12 m, o tamanho de hoje) como
   unidade de entulho; voxel único só quando destruído isoladamente.
5. **Sombra**: `shadow.mapSize` 2048 começa a serrilhar em blocos de 6 cm; usar
   cascata simples (2 mapas: perto 12 m / longe 40 m) ou subir para 4096 no
   desktop.
6. **Chunk meshing** (item opcional da fase 0) se o instanced bater no limite.

---

## Fase 4 — Loop de jogo (opcional, curto)

- Modo **Contrato de demolição**: derrubar N estruturas com M tiros/bombas;
  pontuação por reação em cadeia (voxels que caíram sem tiro direto contam
  ×2).
- Modo **Playground** (o atual).
- Placar local (`localStorage`) e replay do último colapso (câmera livre).

---

## Sequência e esforço

| Fase | Entrega | Esforço |
|------|---------|---------|
| 0 | Grade numérica, dano local, rebuild incremental, render dirty, entulho agrupado | 2–3 dias |
| 1 | Character controller, pulo/corrida/agachar, joystick mobile, passos | 1–2 dias |
| 2 | Infra de prefabs + caixa d'água, capela, moinho; depois 4–10 | 3–5 dias |
| 3 | 0,08 m → 0,06 m, rebalanceamento, detalhe ornamental, sombras | 1–2 dias |
| 4 | Modos de jogo | 1 dia |

Riscos: (a) Rapier com ~5 k colliders estáticos fundidos + centenas de dinâmicos
é ok; sem a fusão de colliders não é. (b) Portas em `door-*` hoje dependem de
índices literais para a dobradiça; migrar para metros antes de mudar o voxel.
(c) `voxelRaycastWorld` faz DDA na grade: com 0,06 m dá 2× mais passos por
raio, aceitável.
