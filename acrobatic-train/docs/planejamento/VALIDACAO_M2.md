# M2 — Implementação e validação automatizada

Data: 06/10/2026. **M2 implementada, com validação automatizada aprovada. Playtest humano pendente.** Esta distinção mantém o gate M2-A07 e as partes humanas dos aceites das fases em aberto.

## Comportamento entregue

- Fase 1 completa: 600 m, quatro barreiras de obras em vias alternadas, itens opcionais e avisos de desvio/alinhamento.
- Fase 2: 750 m, lacunas curtas, reparo duplo com via direita contínua e linhas de itens nas vias seguras.
- Fase 3: 850 m, quatro rampas opcionais, postes entre vias, backflip/giro e anéis posicionados a partir da trajetória balística. Cada rampa mantém rota terrestre; o pouso termina em trilho livre.
- Menu com continuar, mapa de nove fases e briefing. Apenas 1–3 estão implementadas; 4–9 aparecem indisponíveis. Concluir 3 registra liberação lógica de 4 para a M3, mas não permite jogá-la agora.
- Resultado com tempo, score, coletas/manobras, próxima fase, repetir e mapa. Chegar vivo basta; nenhuma meta obrigatória de pontos, compra ou IA.
- Progresso separado da economia e salvo antes de oferecer avanço. Retry/derrota/reload preservam compras e o maior progresso. Não há bônus de chegada ou troféu antecipado.

## Arquitetura e contratos

`src/core/progress-store.js` é o único escritor de `acrobatic_train_campaign_v1`. O schema 1 contém `contentVersion`, resultados, maior fase liberada e conquistas. Só a sequência contínua de conclusões oficiais libera acesso; um campo `highestUnlockedLevel` arbitrário não libera fases sozinho.

Resultados mantêm melhor score, menor tempo de conclusão e número de conclusões. Eventos duplicados são idempotentes dentro da sessão. A migração sintética de schema 0 aceita `completedLevels`/`bestScores`; tempo legado ausente permanece `null`, sem fabricar uma medição. A M1 não tinha save de campanha: essa migração é cobertura preventiva, não prova de dados reais migrados.

JSON corrompido/campos inválidos têm recuperação com aviso; falhas de storage preservam a sessão em memória. Versões futuras desconhecidas permanecem no disco, sem sobrescrita; a sessão continua em memória. As quatro chaves da loja não são lidas/escritas pelo store da campanha.

`RunSession` recebe a política de acesso e recusa fase bloqueada antes de iniciar, além do bloqueio da UI. A integração exige a configuração oficial do registro. IDs/runId continuam protegendo bônus, eventos e navegação.

`src/levels/level-config.js` contém dados autorados, geração de objetos e validação de envelopes. Avisos começam com 2,7 s de antecedência na velocidade máxima, considerando a extremidade longitudinal do trem; isso reserva margem para o HUD de 80 ms. O início `[0,80)` e os últimos 80 m ficam livres de perigos.

`src/physics/acrobatics.js` concentra a mesma detecção de rampas/saltos usada por jogo e testes; dimensões e parâmetros são compartilhados. `collisions.js` verifica barreiras por quatro eixos de separação, postes por distância ao retângulo e coleta por altura. `entities/obstacles.js` cria barreiras com recursos exclusivos e descarte único.

`src/ui/campaign-ui.js` cuida de mapa/briefing/resultado/avisos de salvamento; o HUD recebe snapshots com objetivo, progresso e alerta. Modais usam foco, fundo inert e trap de Tab; o primeiro controle realmente visível recebe foco. O atributo `hidden` prevalece sobre estilos de botões. Layout touch cobre retrato e paisagem.

## Aceites M2

| Aceite | Estado | Evidência |
| --- | --- | --- |
| M2-A01 | Aprovado automaticamente | Save novo libera somente 1; domínio recusa 3; fluxo 1→2→3, continuar após reload, fase 4 indisponível |
| M2-A02 | Aprovado automaticamente | `progress-store.test.js`: schema 0/1, JSON quebrado, campos inválidos, versão futura preservada e storage que lança; E2E com falha real de get/set da chave de campanha |
| M2-A03 | Parte automatizada aprovada; componentes humanos pendentes | Três fixtures, rotas terrestres e aérea, cinco perfis, 30/60/120 FPS, colisões/zonas/avisos e E2E; inspeção de capturas. Não equivale a aprovação humana integral de C-07 |
| M2-A04 | Aprovado automaticamente | Altura de coleta e postes; rota terrestre sem anel; rota aérea com 4 anéis e 4 pousos no navegador |
| M2-A05 | Aprovado no fluxo automatizado | Desktop 1366×768, touch 390×844 e 844×390; mapa, briefing, pausa/loja, resultado, Tab e controles. Leitor de tela não testado |
| M2-A06 | Aprovado automaticamente | Vitória real com score 0 e coleta ativa; saldo 50 permanece 50; libera 2. Retry/derrota/reload preservam compras/progresso |
| M2-A07 | **Pendente de playtest humano** | Requer jogador explicando desvio, gap e rampa, com registro de tentativas/derrotas e feedback |

## Aceites das fases e comuns

F01: zona segura e controles, duas alternativas à primeira barreira, volume físico, passagem lateral/diagonal, vitória com zero pontos e preservação de compras testados. F01-A06 humano continua pendente.

F02: acesso sequencial, frente/traseira e fronteiras das lacunas, reparo duplo, itens em trilho contínuo e progressão/reload testados. Os gaps cortam as faixas de rails e os dormentes no mesmo intervalo usado pela colisão.

F03: rotas com/sem rampas, backflip e giro distintos, coleta aérea por altura, pousos seguros, IA offline e conclusão testados. A fase 4 só será selecionável na M3; a leitura humana dos efeitos e avisos continua pendente.

C-01/C-02/C-03: configurações/envelopes validados, conteúdo determinístico, replays e rotas com todos os perfis. C-04/C-05/C-06/C-09: colisão antes da chegada, idempotência, pause/retry/save, callbacks antigos e acesso. C-08/C-10: descarte, estabilidade amostrada, volumes/altura e IA indisponível. C-07 tem controles, legibilidade das capturas e orçamento automático verificados; avaliação com jogador permanece aberta.

## Execuções

`npm test`: **37 testes passaram**, zero falhas. Quatro são os testes estáticos anteriores; 33 verificam comportamento/conteúdo. As rotas terrestres incluem 45 combinações de fase/perfil/FPS; a rota aérea foi testada com os cinco perfis normalizados.

O harness puro monta os helpers de física de produção e valida rotas/contatos; não substitui o renderer. O E2E usa o código real Three.js, controles reais/handlers do jogo e relógio de teste acelerado. Nenhum transporte/resultado de IA foi contado como prova de gameplay.

| Cenário E2E | Resultado |
| --- | --- |
| Desktop, retrato e paisagem | Passaram 1→2→3, mapa/briefing, touch, pausa→loja→fechar, retry, derrota e reload; zero erros de página |
| Aéreo | Quatro pousos e quatro anéis aéreos; vídeo/capturas registrados |
| Storage indisponível | Libera 2 em memória, aviso persistente no resultado, compras intactas |
| Zero pontos | Fase 1 concluída sem coletar itens, score 0, saldo 50 e fase 2 liberada |
| Recursos | 15 ciclos nas três fases; depois de 5 ciclos de aquecimento, 30 transições amostradas estáveis |
| Regressão M1 | Bônus de resposta antiga rejeitado; infinito chegou a 650,31 m em `playing`, sem modificar progresso oficial |

Recursos amostrados por fase: **58/72/42 geometrias**, respectivamente, e **2 texturas** em todas as amostras. Isso demonstra estabilidade nesses pontos equivalentes, não ausência de qualquer vazamento em toda cena futura.

## Evidências locais

- [UI desktop/retrato/paisagem](../../artifacts/validation/m2-ui-final-20261006/browser-results.json).
- [Mapa](../../artifacts/validation/m2-ui-final-20261006/desktop-map.png), [briefing](../../artifacts/validation/m2-ui-final-20261006/portrait-briefing.png), [touch retrato](../../artifacts/validation/m2-ui-final-20261006/portrait-playing.png), [touch paisagem](../../artifacts/validation/m2-ui-final-20261006/landscape-playing.png).
- [Aéreo/storage/zero pontos/recursos](../../artifacts/validation/m2-extended-20261006/browser-results.json), [amostras de recursos](../../artifacts/validation/m2-extended-20261006/resources.json).
- [Regressão M1](../../artifacts/validation/m2-regression-20261006/browser-results.json).
- [Captura de movimento](../../artifacts/validation/m2-motion-20261006/aerial.webm), [backflip](../../artifacts/validation/m2-motion-20261006/aerial-backflip.png), [resultado aéreo](../../artifacts/validation/m2-motion-20261006/aerial-result.png).
- Fixtures: `tests/fixtures/levels/level-01.json` até `level-03.json`; replays terrestres correspondentes e `level-03-air.json`.

As evidências usam contextos isolados e saves sintéticos, sem sessões do usuário. GPU do teste é SwiftShader; o vídeo usa relógio acelerado/manual. Não comprova FPS de hardware nem ritmo/dificuldade humanos.

## Reprodução e próximo gate

```powershell
npm start
npm test
# Playwright instalado, ou node_modules do runtime configurado:
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser
```

`TEST_SCOPE=ui`, `extended`, `air`, `storage`, `zero-score`, `resources` ou `regression` limita o diagnóstico. Sem escopo, executa todos. A entrada histórica `scripts/test-m1-browser.js` encaminha para a suíte mantida da M2.

Para concluir o gate humano: jogar 1–3 em teclado e touch, registrar causa de cada derrota e confirmar que o jogador distingue frente/traseira, identifica a via contínua e entende as rampas opcionais. Ajustes de aviso/velocidade/layout exigem rerodar as rotas e casos afetados. Medição de hardware e leitor de tela continuam não verificados.
