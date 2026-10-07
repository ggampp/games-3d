# M3 — Implementação e validação automatizada

Data: 07/10/2026. **M3 implementada, com validação automatizada aprovada. Playtest humano pendente.** O gate M3-A07 e as partes humanas de F04-A01, F05-A06 e F06-A01 continuam abertos.

## Comportamento entregue

- Fase 4, *Cancela ferroviária*: 950 m, 20→27 m/s, cinco encontros com cancelas temporizadas. Cada fase tem sempre uma via sem cancela. As cancelas `gate-2` (esquerda) e `gate-3` (direita) chegam abertas, como desafio opcional.
- Fase 5, *Ponte de manobras*: 1100 m, 22→30 m/s, quatro pórticos com abertura em C, R e L e postes de revisão. O encontro final combina um trilho rompido em R com um pórtico aberto em C.
- Fase 6, *Cruzamento em movimento*: 1200 m, 24→33 m/s, quatro vagões de manutenção vindos da esquerda ou da direita e uma rampa opcional antes do cruzamento final, que combina trilho rompido em C com vagão em L.
- O mapa libera as fases 4–6 em sequência. Concluir a fase 6 registra a liberação lógica da 7, mas as fases 7–9 continuam indisponíveis até a M4. Não há bônus de chegada nem troféu antecipado.
- O aviso do HUD acrescenta o estado vivo do perigo, tirado do relógio da simulação: `ABERTA`, `SINAL ATIVO`, `FECHANDO`, `FECHADA` e `ABRINDO` na cancela, `VAGÃO PARADO`, `ENTRANDO`, `NA VIA` e `SAINDO` no vagão. A seta (⇢/⇠) no texto indica de que lado o vagão vem, sem depender de cor.
- Som de sino quando uma cancela à frente (até 160 m) entra em aviso e alerta de dois tons quando um vagão começa a entrar. Os dois respeitam o mudo.

## Arquitetura

- `src/physics/hazards.js`: módulo puro, sem DOM nem renderer.
  - **Cancela**: ciclo da cancela, com fronteiras semiabertas `[início, fim)`, e colisão da haste como segmento espesso no corte (lateral, altura) contra a fatia real da pegada inclinada do trem. O poste colide como os postes da fase 3.
  - **Pórtico**: caixas laterais e lintel, testadas por SAT e intervalo de altura. Não existe atalho por nome de via.
  - **Vagão**: trajetória em função do tempo de simulação e teste contínuo (`sweptHitsWagon`). Trem e vagão são interpolados entre ticks, com subamostras proporcionais ao movimento relativo.
  - **`HazardWorld`**: executa as três famílias para uma tentativa. É a mesma classe em `game.js` e no harness de rotas.
- `src/levels/hazard-registry.js`: registro família → validação, conteúdo determinístico e estado para o HUD.
  - `arrivalTimeS` usa o mesmo integrador do `RunSession` para converter a chegada prevista em `phaseOffsetS` (cancela) ou `startTimeS` (vagão). Esses valores ficam gravados nas fixtures.
- `src/entities/obstacles.js`: as malhas de cancela, pórtico e vagão leem o mesmo estado que o colisor (`update(timeS)`) e têm descarte único. As partes móveis entram na interpolação de render.
- `src/levels/level-config.js`:
  - Fases 4–6 e orçamento por grupo de dificuldade (`budgetFor`), conforme CONTRATOS §2.
  - `effectiveWarningS` mede o tempo real de aviso. O aviso só aparece depois que o encontro anterior termina.
  - `requiredWarningS` aplica a fórmula `max(aviso, reação + k·0,28 + 0,15)`.
  - Encontros combinados (`group`) dispensam o descanso entre si, mas precisam usar a mesma via segura.
- `src/core/progress-store.js`: `PLAYABLE_LEVELS` libera as fases 1–6. `CONTENT_VERSION` passa a `m3-v1`. As fases 1–3 continuam `m2-v1`, com conteúdo idêntico. Nas fixtures delas só entraram os arrays vazios `gates`, `gantries` e `wagons`.

## Decisões e desvios do plano

1. **A janela da cancela não depende de sorte nem de sincronização.** O jogo não tem freio nem acelerador, então o instante de chegada é determinístico. Cada cancela declara seu estado na chegada (`arrivalCycleS`), e o `phaseOffsetS` é derivado disso. Passar pela cancela aberta é um desafio de leitura, não de timing. A rota pela via sem cancela passa com qualquer offset (F04-T04).
2. **Ciclo de 8 s**: aberta 3 s, aviso 2 s (a haste desce nos últimos 0,6 s), fechada 2 s, reabertura 1 s. A haste passa continuamente por todas as alturas intermediárias, sem troca instantânea do colisor.
3. **Pórtico**: abertura de 2,6 m, o que dá 0,45 m de folga por lado para o trem alinhado. O lintel fica a 4,4 m: o salto de troca de via (0,9 m) passa por baixo, mas um salto de rampa bate. Os laterais vão do chão ao teto, então a diagonal colide.
4. **Vagão**: repousa a 7,5 m do eixo (fora do lastro), entra em 2,0 s, permanece 2,4 s e sai em 2,0 s. Fica totalmente na via 0,9 s antes da chegada do centro da locomotiva. O validador recusa trajetórias que varram a via segura ou que repousem dentro do envelope da via.
5. **Painel da fase reposicionado (C-07)**: nas capturas, o painel de progresso cobria o horizonte, onde os perigos aparecem a 60–100 m. Ele foi movido para o canto superior esquerdo no desktop, para baixo, acima dos controles touch, no retrato, e para a esquerda, compacto, na paisagem touch. O objetivo opcional sai do painel em telas pequenas, porque já aparece no briefing.

## Aceites M3

| Aceite | Estado | Evidência |
| --- | --- | --- |
| M3-A01 | Aprovado automaticamente | Fronteiras do ciclo, haste contínua, pausa de 5 s congela ciclo/haste/distância (Node e navegador), rota sem cancela passa com offsets 0/2/4/6 s |
| M3-A02 | Aprovado automaticamente | Alinhado passa; folga ±0,05 m; diagonal, lateral e lintel colidem; `HazardWorld` checa o pórtico também durante salto |
| M3-A03 | Aprovado automaticamente | Varredura detecta cruzamento com extremos separados (longitudinal e lateral); vagão nunca nasce na via; via de escape livre em todas as amostras de 1/60 s |
| M3-A04 | Aprovado automaticamente | Fases 4–6 com os cinco perfis a 30/60/120 FPS, rotas de reação tardia, fixtures/replays e C-01..C-10 automatizáveis |
| M3-A05 | Aprovado automaticamente | Malha da cancela coincide com o colisor (ponta da haste, tolerância 1e-6); posição do vagão igual à trajetória; mesmo tick final a 30/60/120 FPS |
| M3-A06 | Aprovado automaticamente | Fases 1–3 sem alteração de conteúdo; suíte M2 completa no navegador passou; 30 ciclos sem crescimento de geometrias/texturas |
| M3-A07 | **Pendente de playtest humano** | Requer jogador identificando fechamento da cancela, abertura do pórtico e direção do vagão antes do risco |

## Aceites das fases e comuns

F04: primeira cancela isolada com aviso de 2,70 s (mínimo exigido: 2,00 s). Ciclo e volume são iguais entre malha e colisor. A pausa congela tudo. A rota segura independe do ciclo. A mesma via passa aberta e colide fechada, inclusive no fechamento (5,2) e na reabertura (6,8). Concluir libera a fase 5 com zero pontos. F04-A01 humano pendente.

F05: o trem alinhado passa com os cinco perfis. Frente na abertura não libera o resto do corpo. O teto é tratado pela altura real. R→L exige 1,71 s pela fórmula e tem 2,70 s. A combinação trilho + pórtico mantém C. Concluir libera a fase 6. A compreensão da leitura do pórtico (F05-A06) depende de playtest.

F06: o vagão é visível no ramal antes de entrar, com a seta no chão e no HUD. A colisão contínua é independente do FPS. A via de escape fica livre durante todo o encontro. A pausa congela o vagão e o retry reproduz a trajetória. A variante com salto pousa antes do aviso final. Concluir libera a 7 logicamente, e os recursos voltam à linha de base. F06-A01 humano pendente.

C-01..C-10: os mesmos critérios da M2, aplicados às fases 4–6. A legibilidade com jogador real (C-07) continua aberta.

## Execuções

`npm test`: **53 testes passaram**, zero falhas. São 37 anteriores (com a regra de desbloqueio atualizada para 1–6) e 16 em `tests/m3-hazards.test.js`.

| Cenário E2E (`npm run test:browser:m3`) | Resultado |
| --- | --- |
| Desktop teclado 1366×768 e retrato touch 390×844 | Passaram 4→5→6: mapa, briefing, aviso com estado vivo, pausa real congelando perigos, resultado; fase 7 bloqueada; zero erros de página |
| Derrota por família | Sem input: cancela a 125,2 m, pórtico a 314,7 m, vagão a 144,2 m; mensagem específica no modal. As distâncias coincidem com o harness Node |
| Cancelas abertas | Rota opcional cruzando `gate-2` (L) e `gate-3` (R) abertas conclui a fase 4 |
| Recursos | 15 ciclos nas fases 4–6; depois de 5 ciclos de aquecimento, 30 transições amostradas estáveis: **96/63/83 geometrias** e 2 texturas |
| Regressão M2 (`npm run test:browser`) | Suíte completa da M2 passou com a build M3; ajustada só para a fase 4 agora jogável após a 3 |

## Evidências locais

- [Resultados E2E M3](../../artifacts/validation/m3-e2e-20261007/browser-results.json) e [amostras de recursos](../../artifacts/validation/m3-e2e-20261007/resources.json).
- Capturas desktop: [cancela fechando](../../artifacts/validation/m3-e2e-20261007/m3-desktop-gate-closing.png), [pórtico](../../artifacts/validation/m3-e2e-20261007/m3-desktop-gantry.png), [vagão cruzando](../../artifacts/validation/m3-e2e-20261007/m3-desktop-wagon-crossing.png), [resultado da fase 6](../../artifacts/validation/m3-e2e-20261007/m3-desktop-result-6.png); as mesmas em `m3-portrait-*`.
- Derrotas: [cancela](../../artifacts/validation/m3-e2e-20261007/m3-crash-level-04.png), [pórtico](../../artifacts/validation/m3-e2e-20261007/m3-crash-level-05.png), [vagão](../../artifacts/validation/m3-e2e-20261007/m3-crash-level-06.png).
- [Regressão M2 na build M3](../../artifacts/validation/m2-regression-m3-20261007/browser-results.json).
- Fixtures: `tests/fixtures/levels/level-04.json` até `level-06.json`. Replays: `level-04.json` até `level-06.json`, mais `level-04-open-gates.json` e `level-06-air.json`.

As evidências usam contextos isolados e saves sintéticos. A GPU do teste é SwiftShader, a cerca de 2 FPS tanto na fase 3 quanto nas fases 4–6, com relógio manual. Isso não comprova FPS de hardware, ritmo nem dificuldade para humanos. Os sons foram verificados só pelo código (chamada e mudo), não de ouvido.

## Reprodução e próximo gate

```powershell
npm test
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser:m3   # TEST_SCOPE=ui | crash | resources
npm run test:browser      # regressão M0–M2
```

Para concluir o gate humano, jogar as fases 4–6 em teclado e touch e registrar a causa de cada derrota. O jogador precisa:

- antecipar o fechamento da cancela pelo sinal e pela haste;
- identificar a abertura do pórtico e a necessidade de alinhar frente e traseira;
- ler de que lado vem o vagão antes de ele entrar na via.

Ajustes de ciclo, volume, velocidade ou layout exigem rerodar as rotas e os casos afetados. A medição em hardware e o leitor de tela continuam não verificados.
