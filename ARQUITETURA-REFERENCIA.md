# Arquitetura de referência — padrões extraídos de `hit-and-run-web`

Estudo do clone em `_reference/hit-and-run-web`, uma reconstrução de *The Simpsons: Hit & Run*
em Three.js. Interessa aqui a arquitetura, não os assets.

O projeto roda um jogo de mundo aberto com 89 missões usando **apenas `three` e
`three-mesh-bvh`**. Sem engine, sem ECS, sem Rapier, sem store de estado, sem Vitest.
Todo o gameplay cabe em cerca de 250 linhas de lógica.

---

## A regra que gera todas as outras

> **Nenhuma classe de gameplay lê o relógio, e nenhuma escreve num `Object3D`.**

Se um sistema recebe `dt` como parâmetro e muta apenas objetos simples, ele já é testável
no Node sem mock nenhum. Foi essa restrição, assumida desde o início, que permitiu validar
610 estágios de missão sem abrir um navegador.

As duas consequências práticas:

- O acumulador de passo fixo existe em **um único lugar**. Todo o resto recebe `dt`.
- O estado lógico é um objeto simples com um `Vector3` dentro. O `Group` do carro só é
  tocado na camada de render, com um `copy()` no fim do frame.

---

## 1. Passo fixo com interpolação

O núcleo tem 15 linhas e serve jogador e todos os NPCs pelo mesmo tipo estrutural.

```js
accumulator += dt;
while (accumulator >= 1/60) {
  motion.capture(state);   // guarda a pose ANTES de simular
  simular(1/60);
  accumulator -= 1/60;
}
motion.sample(state, accumulator * 60);   // lerp entre pose anterior e atual
car.position.copy(motion.position);
```

Três detalhes que fazem a diferença e são fáceis de errar:

- **Interpolação de ângulo pelo arco curto.** Sem normalizar a diferença para o intervalo
  de menos pi a pi, o veículo gira 350 graus em vez de menos 10 ao cruzar a virada.
- **Um `reset()` para descontinuidades.** Respawn, despausar, entrar no carro e trocar de
  nível precisam zerar a interpolação, senão o teleporte vira um deslizamento visível.
- **Clamp do delta em 0,08 s.** Limita a cinco passos por frame e evita a espiral da morte
  depois de a aba ficar em segundo plano.

**Independência de framerate em todo lugar.** Nunca `speed *= 0.98`. Sempre
`speed *= Math.exp(-drag*dt)` para atrito e `MathUtils.damp(a, b, lambda, dt)` para
suavização. Vale para esterço, câmera, campo de visão e inclinação do veículo.

Aplicar em: [shot-gun-3d/](./shot-gun-3d), [nieve/](./nieve), [canyon-rails/](./canyon-rails),
qualquer coisa com física. Hoje nossos jogos simulam no delta variável do frame.

---

## 2. Lógica de missão isolada do motor gráfico

O padrão mais valioso do repositório, e o mais transferível.

O motor da campanha importa apenas os próprios tipos. Nada de Three.js, nada de DOM.
A interface inteira são duas chamadas:

```
tick(dt, snapshot)  →  recebe uma descrição do mundo como objeto simples
drain(): Effect[]   →  devolve efeitos a aplicar, nunca aplica nada
```

O instantâneo é a **única** fronteira do mundo para a lógica. Os efeitos são a **única**
fronteira da lógica para o mundo. O motor jamais toca a cena, a cena jamais lê estruturas
internas do motor. Um adaptador separado é o único módulo que conhece Three.js.

Como o instantâneo usa tuplas de três números em vez de `Vector3`, montar um caso de teste
é escrever um objeto literal.

**Um estágio é um objetivo tipado, mais N condições de falha, mais um saco de comandos
crus.** Os tipos de objetivo e de condição são listas fechadas validadas no construtor, que
falha imediatamente para a campanha inteira se algo estiver fora. Os parâmetros saem dos
comandos sob demanda com dois utilitários de uma linha, então o compilador de dados não
precisa entender a semântica de cada comando, só empacotá-los.

**Checkpoint por reexecução de comandos, não por serialização do mundo.** Salvar a fase, o
estágio, o tempo restante e a pose do jogador, e então reexecutar os comandos dos estágios
anteriores, sai muito mais barato e robusto que um instantâneo binário da cena.

Aplicar em: [pequeno-reino/](./pequeno-reino) e [nieve/](./nieve), que já têm progressão.
E em qualquer jogo nosso que ganhe campanha.

---

## 3. Dados compilados, nunca escritos à mão

As missões não são JSON editado manualmente. Um compilador em Python transforma os scripts
originais em JSON denso e, no mesmo passo:

- resolve referências de texto e de posições em tempo de build;
- **falha** se um estágio não tem exatamente um objetivo;
- emite um catálogo com estatísticas e a lista de referências quebradas.

O compilador de dados é também o linter. Erros de conteúdo morrem antes do runtime.

Vale para tabelas de balanceamento, catálogos de itens e diálogos. Hoje nossos jogos
carregam essas coisas como literais no código.

---

## 4. Testar sem navegador

Uma linha de configuração, sem Vitest, sem Jest, sem jsdom, sem Playwright:

```
node --import tsx --test tests/*.test.ts
```

A alavanca: **Three.js roda no Node desde que você toque só a camada de matemática.**
Vetores, curvas, `Raycaster`, `BufferGeometry` e `MathUtils` funcionam sem WebGL. Só o
renderizador, texturas e o DOM não.

O que os testes deles asseguram é mais interessante que o quanto cobrem. São invariantes
escritos à mão, não valores fixos:

- nenhum carro do tráfego se desloca mais de 0,19 m num passo, o que pega qualquer salto
  de posição em junção;
- o movimento por passo fica entre 0,095 e 0,105 m com variação de rumo abaixo de 0,1,
  o que valida velocidade constante e continuidade de tangente ao mesmo tempo;
- renderizar a 120 Hz sobre física a 60 Hz move exatamente a mesma distância;
- um veículo que já está se separando de uma barreira não recebe segundo impulso nem dano.

Isso captura tremulação, salto e repique duplo. Classes de bug que screenshot e revisão
visual não pegam.

Fábricas com `Partial<T>` e espalhamento deixam cada teste em uma a três linhas.

---

## 5. Desempenho, técnicas concretas

| Técnica | Mecanismo |
|---|---|
| Draw calls | Geometrias clonadas com a matriz já aplicada e fundidas por material, uma malha por material por região |
| Raycast | `three-mesh-bvh` registrado uma vez nos protótipos, com `firstHitOnly` em todos os raycasts |
| Broadphase | Grade uniforme de 20 m montada no construtor, consulta só a vizinhança 3x3 |
| Espalhamento incremental | Orçamento duplo por frame, no máximo 24 itens **e** 1 ms, com fila ordenada por distância |
| Grade toroidal | Reaproveita os mesmos slots de instância ao andar, sem realocar nada |
| Sombras | Uma luz direcional com câmera ortográfica apertada que segue o jogador |
| Corte por distância | Escondido pela névoa, para eliminar o surgimento abrupto |
| Instâncias | Escondidas com escala zero, a contagem nunca muda |
| Hot path | Vetores e matrizes pré-alocados no escopo do módulo, zero coleta de lixo |
| Métricas | Dois buffers circulares de `Float32Array` com percentil, sem alocar por frame |
| Modo performance | Uma linha desliga sombras, derruba a densidade de pixel e pula o pós-processamento |
| Ciclo de vida | Um `AbortController` do módulo remove todos os listeners de uma vez, ligado também ao descarte do hot reload |

---

## 6. Pipeline de assets

- **Formato próprio, um glTF caseiro.** Cada modelo é um manifesto JSON mais um `.bin`, e
  cada atributo aponta para o buffer como deslocamento e contagem. O carregamento cria
  views tipadas direto sobre o buffer, sem parse de vértices.
- **Nomes por hash de conteúdo.** Dá deduplicação automática e cache eterno no navegador.
- **PNG e WebP para toda textura**, com tentativa no WebP e queda para PNG no catch.
- **Deduplicação de downloads concorrentes** com um mapa de promessas pendentes, em cinco
  linhas. Várias regiões pedindo a mesma textura compartilham um único download.
- **Cache de material por chave estrutural**, pré-requisito para a fusão por material funcionar.
- **Pré-compilação de shaders** antes de liberar o jogo, para não travar no primeiro frame.

---

## 7. O que não copiar

- **O estilo de código.** Linhas de mais de 400 colunas com vários comandos empilhados.
  É escolha estética do repositório, não parte da arquitetura.
- **O arquivo orquestrador central.** São 29 KB com uma função de animação de 80 linhas
  misturando entrada, gameplay, HUD e render. É o custo do modelo de singleton de módulo e
  escala mal além de um jogo desse porte.
- **Estado roteado por DOM oculto.** Existe uma camada de elementos invisíveis usada como
  barramento de texto entre subsistemas. É dívida de migração. Passe os valores num objeto
  de leitura.
- **O módulo de áudio.** São 14 linhas com três elementos de áudio fixos, sem Web Audio,
  sem barramentos, sem efeitos pontuais. O nosso [nieve/src/audio.js](./nieve/src/audio.js)
  já é mais completo. A única ideia aproveitável é a flag que abaixa música e motor durante
  cutscenes.
- **Animações inline no JSON.** O descritor do Apu tem 581 KB contra 193 KB de binário,
  três vezes maior que os dados que descreve. Animação pertence ao buffer.
- **Ausência de nível de detalhe.** Não há `THREE.LOD` no projeto. Substituíram por névoa e
  corte de distância, o que funciona para o escopo deles mas não generaliza.

---

## Ordem sugerida de adoção

1. Passo fixo com interpolação, e `exp(-k*dt)` no lugar de multiplicadores constantes.
   Ganho imediato de suavidade e de consistência entre máquinas.
2. Testes em `node --test` sobre a camada de matemática do Three.js. Barato de montar e
   pega bugs que não aparecem em captura de tela.
3. Instantâneo entrando e efeitos saindo, para a lógica de progressão.
4. Fusão por material e registro do BVH, quando o volume de cena justificar.

## Arquivos para ler primeiro

Todos em `_reference/hit-and-run-web`:

- `src/campaign/types.ts` — o esquema inteiro de campanha em 20 linhas, comece por aqui
- `src/motion.ts` — interpolação de render completa em 15 linhas
- `src/campaign/engine.ts` — a máquina de estados pura, sem Three.js
- `src/traffic-path.ts` — junções em Bézier com continuidade de tangente
- `src/physics.ts` — modelo arcade, grade uniforme e resolução de penetração
- `src/performance.ts` — percentis em buffer circular, 10 linhas
- `VALIDATION.md` — como registram medições e declaram os limites do que testaram
