# Linha de Visão

Puzzle 3D de **ilusão de perspectiva** no browser (Three.js, câmera ortográfica).
Uma bola sai do lampião e rola por vigas amarelas que flutuam no espaço. Você gira a
estrutura: quando duas vigas *parecem* se encostar na tela, elas *estão* conectadas.
Leve a bola até o pino de boliche.

Inspirado no gênero de puzzles de perspectiva impossível (Echochrome, Monument Valley).
Fases, regras e arte são originais.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do núcleo lógico (node:test, sem navegador)
npm run build
```

## Regras

1. **Se parece conectado, está conectado.** Duas pontas abertas de vigas diferentes que
   caem no mesmo ponto da tela viram uma ligação: a bola passa de uma para a outra,
   mesmo estando a metros de distância em 3D.
2. **O que não se vê não existe.** Um vão escondido atrás de um bloco (laranja) pode ser
   atravessado, mas só enquanto continuar escondido. Gire no meio da travessia e a bola cai.
3. Pontas abertas sem ligação derrubam a bola (ela volta ao lampião). Batentes fazem ela voltar
   pelo mesmo trilho, e na volta a mesma ponta pode se encostar em outra viga.
4. Dá para girar com a bola rolando, e as fases mais avançadas exigem isso.

## Fases

| # | Fase | O que ensina |
|---|---|---|
| 1 | Ponto de vista | primeira ligação: duas vigas viram uma |
| 2 | Duas verdades | duas ligações, girando com a bola rolando |
| 3 | O que não se vê | vão escondido atrás de um bloco |
| 4 | Atrás do cubo | ligação seguida de vão |
| 5 | Escada de Penrose | escada que só sobe numa vista isométrica |
| 6 | A ponte | três ângulos seguidos |
| 7 | Vai e volta | o batente devolve a bola para outra ligação |
| 8 | Ladeira | rampas também se encostam |
| 9 | Encruzilhada | uma ponta, duas ligações; uma é armadilha |
| 10 | Atrás da coluna | coluna em diagonal esconde o vão |
| 11 | Zigue-zague | sobe, desce, sobe: um lado da estrutura por degrau |
| 12 | Fim da linha | ligação, batente, ligação e vão na mesma corrida |

Estrelas: 3 sem quedas, 2 com até duas quedas, 1 nos demais casos.

## Controles

| Ação | Mouse / toque | Teclado |
|---|---|---|
| Girar a vista | arrastar | ← → ↑ ↓ ou WASD |
| Soltar a bola | botão *Soltar a bola* | Espaço |
| Reiniciar | ↺ | R |
| Fases | ☰ | Esc |

A vista tem **encaixe magnético**: perto de um ângulo de ilusão ela "gruda", e ao soltar
o arraste ela se ajusta sozinha se estiver a poucos graus. Um anel branco marca a junção ativa.

## Como a ilusão funciona

Com projeção ortográfica, dois pontos A e B caem no mesmo pixel exatamente quando `B − A`
é paralelo à direção de vista. Então, para cada par de pontas abertas, o ângulo da ilusão
tem forma fechada (`linkAngles` em `src/core/math.js`):

```
yaw   = atan2(dx, dz)
pitch = atan2(|dy|, hypot(dx, dz))
```

A ligação fica ativa quando a distância entre as projeções é menor que 0,035 unidade.
Os vãos usam raios do ponto em direção à câmera contra as caixas dos blocos e colunas
(`isHidden` em `src/core/level.js`). A luz é fixa no mundo e **não há sombras**: sombra
denunciaria a profundidade e quebraria a ilusão.

## Arquitetura

```
src/
  core/            lógica pura (arrays [x,y,z], sem Three.js, testável no Node)
    math.js        vetores, base da câmera, projeção, ângulos de ligação, raio × AABB
    level.js       monta trilhos, pontas, vãos, oclusores e pares de ligação de uma fase
    view.js        vista crua do input + encaixe magnético; ligações ativas; vão escondido
    ball.js        máquina de estados da bola: drop → ready → rolling/gap → ledge/falling → won
  render/scene.js  extrusão das vigas com meia-esquadria, colunas com pé curvo, lampião,
                   pino, bola + "fantasma" (silhueta quando atrás de algo), confete
  audio.js         efeitos sintetizados com WebAudio
  levels.js        as 12 fases (dados declarativos)
  main.js          loop, input, HUD, progresso (localStorage)
tests/core.test.js
```

Seguindo `../ARQUITETURA-REFERENCIA.md`: nenhuma classe de gameplay lê o relógio nem
escreve em `Object3D`; o render só copia o estado no fim do frame.

Os testes incluem um **oráculo**: uma busca em largura no grafo (trilho → salto → trilho,
com o batente devolvendo a bola pelo mesmo trilho) acha o caminho do lampião ao pino, e uma simulação ajusta a câmera para cada salto na
hora em que a bola se aproxima. Toda fase precisa ser vencida pelo oráculo e **não**
pode ser vencida com a vista inicial parada.

## Criando fases

Em `src/levels.js`, cada viga é uma polilinha da superfície de rolagem com tipo de ponta
(`start`, `goal`, `open`, `cap`). Para uma ligação limpa, use deslocamentos isométricos
entre as pontas, `k·(±1, 1, ±1)` (pitch 35,26°) ou `k·(1, 1, 0)` (pitch 45°), com o
pitch entre 20° e 72°. Rode `npm test` para validar.
