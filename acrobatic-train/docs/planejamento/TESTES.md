# Estratégia e catálogo de testes

Status: catálogo de testes planejado originalmente; **testes M0/M1/M2 implementados e executados** em 06/10/2026 e **M3/M4** em 07/10/2026 (`tests/m3-hazards.test.js`, `tests/m4-campaign.test.js`, `scripts/test-m3-browser.js`, `scripts/test-m4-browser.js`). Veja o [relatório M4](VALIDACAO_M4.md), o [relatório M3](VALIDACAO_M3.md), o [relatório M2](VALIDACAO_M2.md) e o [histórico M0/M1](VALIDACAO_M0_M1.md). Existem agora testes de loja, estado, simulação, HUD e recursos, além do harness `scripts/test-m1-browser.js`. Os casos de M5–M6 e os nomes ainda não criados abaixo continuam como propostas.

## 1. Organização proposta

Usar `node:test` e asserções reais para módulos sem DOM. Arquivos executáveis propostos no primeiro nível de `tests/`, pois `scripts/jev/test-coverage.js` atualmente só procura `.test.js`/`.spec.js` nesse nível. Fixtures podem ficar em subpastas.

| Arquivo proposto | Responsabilidade |
| --- | --- |
| `tests/shop-integration.test.js` | Contratos de saldo, equipamento e save legado |
| `tests/game-state.test.js` | Estados, pausa e identidade de tentativa |
| `tests/simulation.test.js` | Relógio, comandos e reproducibilidade |
| `tests/campaign.test.js` | Chegada, avanço, seleção e troféu |
| `tests/progress-store.test.js` | Versões, corrupção e erro de storage |
| `tests/collisions.test.js` | Altura, volumes, lacunas e obstáculos móveis |
| `tests/level-content.test.js` | Nove configurações e rotas de referência |
| `tests/resource-lifecycle.test.js` | Propriedade/descarte e listeners |
| `tests/multiplayer.test.js` | Salas, protocolo, simulação e resultados |
| `tests/mods.test.js` | Schema, orçamento, ativação e isolamento |
| `tests/browser.spec.js` | Fluxos E2E reais, com harness de navegador a escolher na implementação |

Comando existente possível para o arquivo atual: `node --test tests/architecture-spec.test.js`. Não foi usado nesta entrega como prova das novas features. Comandos futuros para unitários/E2E devem ser adicionados na implementação, com ambientes separados; não existe hoje `npm test` no manifest lido.

Fixtures propostas: `tests/fixtures/levels/level-01.json` até `level-09.json`, `tests/fixtures/replays/level-01.json` até `level-09.json`, saves válidos/legados/corrompidos, perfis de trens e pacotes válidos/inválidos de mods. Replay registra versão, seed, perfil, inputs por tick e resultado esperado. Não registrar credenciais ou sessões.

## 2. Catálogo comum às nove fases

| ID / tipo | Precondição e procedimento | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| TC-01 / unitário e conteúdo | Validar cada fixture; mutar velocidade para valor inválido, intervalo invertido e colisor invadindo início/chegada | Válidos aceitos; inválidos recusados com campo/motivo; nenhum objeto perigoso fora do envelope permitido | C-01 |
| TC-02 / integração | Rodar o mesmo replay/seed com render a 30, 60 e 120 FPS; ligar/desligar partículas/áudio | Mesmo hash de layout, mesmos eventos/ticks terminais e pontuação determinística; efeitos não consomem RNG de conteúdo | C-02 |
| TC-03 / integração | Executar a rota de referência por fase/perfil; validar conexões de encontros e max speed | Chegada viva; nenhum trecho exige estado inalcançável; trem gratuito passa; registrar tentativas/perfis testados | C-03 |
| TC-04 / unitário | Posicionar locomotiva antes/depois da chegada; injetar colisão no mesmo tick; repetir evento de conclusão | Vivo conclui uma vez; colisão produz derrota; nenhum bônus extra de chegada; nenhuma fase posterior libera em derrota | C-04 |
| TC-05 / E2E | Pausar 5 s reais, abrir/fechar loja, fazer retry e voltar ao menu | Tempo/distância/perigos congelados na pausa; pausa manual preservada; retry reseta tentativa, não compras; menu bloqueia inputs | C-05 |
| TC-06 / unitário e integração | Adiar fetch/timer da tentativa A, iniciar B e liberar callback de A; terminar B com callback pendente | Estado, score e saldo de B iguais ao valor anterior; callback não abre modal antigo | C-06 |
| TC-07 / E2E e humano | Rodar desktop 1366×768, touch 390×844 e 844×390; navegar sem mouse; medir aviso real | Controles acionam a função certa; foco não fica atrás do modal; aviso respeita orçamento; nenhuma informação vital cortada | C-07 |
| TC-08 / recursos | Aquecer cena por 5 ciclos; repetir fase/troca 30 vezes; instrumentar dispose/listeners/timers | Recursos exclusivos liberados uma vez; compartilhados preservados até encerramento; sem tendência crescente após aquecimento; critérios detalhados abaixo | C-08 |
| TC-09 / persistência | Novo save, tentativa de fase bloqueada, conclusão sem pontos, reload e replay de fase concluída | Apenas 1 inicial; desbloqueio correto; chegada basta; compras intactas; replay não retrocede progresso | C-09 |
| TC-10 / física e integração | Passar no volume e fora dele; passar sob item aéreo; API indisponível | Contato real colide; exterior passa; item aéreo exige altura; rota/conclusão funciona sem IA | C-10 |

Teste de conteúdo deve validar o orçamento de aviso/reação de cada encontro na velocidade máxima, incluindo o colisor dianteiro e o estado de entrada. Testar somente presença de uma via livre não comprova rota alcançável.

## 3. Recursos, desempenho e evidência

Instrumentar recursos exclusivos e compartilhados por proprietário. Capturar `renderer.info.memory`, contagem de materiais via registro do projeto, objetos de cena, callbacks e listeners. Material não é contado automaticamente como geometria pelo renderer. Usar contadores explícitos para verificar dispose único.

Após 5 ciclos de aquecimento, comparar os 30 ciclos seguintes em pontos equivalentes da mesma cena: sem crescimento monotônico, contadores exclusivos zerados após desmontagem e contagem de listeners/timers no baseline. Caches documentados podem estabilizar acima do valor inicial; justificar a propriedade, limite e descarte. Não usar um único screenshot de memória como prova.

Desempenho proposto: no desktop de referência, 95% dos frames abaixo de 20 ms em 60 s de fase exigente após aquecimento; em mobile, 95% abaixo de 33,3 ms no aparelho de referência. São budgets iniciais, a confirmar com ambiente registrado; não equivalem a desempenho já medido. Se falhar, reduzir orçamento visual e repetir antes de concluir o marco. Inputs não podem se perder sob carga.

Evidência proposta: `artifacts/validation/<runId>/`, relatório com IDs dos testes/aceites, seed, versões, navegador/aparelho, frame times e resultado. Screenshots/clipes mostram aviso, colisão e resultado, acompanhados de asserções/logs. Diretório ainda não criado nesta tarefa.

## 4. Playtest humano

Para cada fase, realizar pelo menos uma sessão desktop e uma touch com pessoa diferente do implementador quando disponível. Registrar tentativas, conclusões, causa de derrota, aviso percebido, clareza do objetivo e controles. Não declarar percentual de sucesso populacional por uma amostra pequena.

Fases fáceis: verificar se o jogador consegue explicar o controle novo e identificar a rota segura. Médias: verificar se o obstáculo novo é compreendido antes da primeira derrota. Difíceis/final: exigir que a causa da derrota seja identificável e que o jogador consiga planejar uma correção para a tentativa seguinte. Ajustar números se a dificuldade vier de falta de leitura, e rerodar as rotas automáticas após ajuste.

## 5. Gates por entrega

- M0: regressão da loja e dos dados antigos; contratos consolidados.
- M1: estados/relógio/seed/chegada/runId passando e fase 1 básica jogável.
- M2: fases 1–3 com C-01 a C-10, testes locais F01/F02/F03 e playtest registrados.
- M3: fases 4–6 com o mesmo conjunto, mais colisão contínua e ciclos dos obstáculos.
- M4: fases 7–9, campanha inteira, troféu e infinito independentes; recursos/desempenho medidos.
- M5: dois clientes reais e testes de protocolo/abandono/latência; replay isolado não entrega multiplayer.
- M6: pacotes válidos e adversariais; rollback e isolamento de save/economia.

Para cada arquivo de marco/fase, a tabela de testes mapeia os aceites locais. Aceites comuns são herdados explicitamente. Falhas em chegada, colisão, corrupção de progresso, duplicação de saldo, execução arbitrária de mods ou autoridade da rede são bloqueantes. Alteração de perfil físico invalida as rotas das fases afetadas.

## 6. Registro de resultados

Modelo a preencher durante a implementação:

| Aceite | Teste(s) | Versão / fixture / ambiente | Resultado | Evidência |
| --- | --- | --- | --- | --- |
| C-01 ou ID local | TC-01 ou ID local | A preencher | Não executado | A preencher |

Não converter `não executado` em aprovado por inferência, saída de demo Jev ou leitura de documentação. A cobertura semântica pode auxiliar triagem; asserções e evidência de execução definem o aceite.
