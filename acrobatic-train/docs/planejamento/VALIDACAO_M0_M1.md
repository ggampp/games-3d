# Validação M0 e implementação M1

Data: 06/10/2026. **M0 validada após correções de integração; M1 implementada e validada no escopo básico.** O usuário confirmou que a Train Shop estava concluída e liberou seus arquivos para integração.

## Entrega

O menu oferece fase 1 básica e modo infinito. A fase tem 600 m, velocidade de 14→18 m/s, layout reproduzível e 25 itens opcionais. Chegada viva exibe tempo, pontuação e ações de repetir/voltar. Não exige compra nem pontuação mínima. Barreiras, mapa, fase 2, save da campanha e troféu continuam nos marcos M2–M4.

Foram criados módulos de estado, eventos, relógio fixo, RNG, integração da loja, movimento, colisão/coleta, percurso, configuração da fase, sessão, interpolação, descarte e dialogs. `game.js` continua como coordenador Three.js; não houve reescrita completa do motor.

## M0 — aceites

| Aceite | Resultado | Evidência |
| --- | --- | --- |
| M0-A01 | Aprovado: catálogo único, preços preservados, perfil numérico em SI e escritor único | `shop-integration.test.js`, M0-T01; `shop-state.js` |
| M0-A02 | Aprovado: quatro chaves preservadas; saldo zero válido; JSON inválido tratado por chave; storage indisponível usa memória | M0-T02, fixtures sintéticas de save e reload no E2E |
| M0-A03 | Aprovado: compra repetida não debita; crédito repetido não duplica; saldo não negativo | M0-T03 |
| M0-A04 | Aprovado: equipamento bloqueado/desconhecido recusado; seleção durante tentativa só vale na próxima | M0-T04; E2E compara seleção, perfil e modelo ativo após T |
| M0-A05 | Aprovado no fluxo automatizado: compra, equipamento, teclado/touch, apito, pausa e retry | E2E desktop/mobile; teste de roteamento British com quatro tons |
| M0-A06 | Aprovado: 12 carros, retenção da cauda, recursos com descarte único e responsabilidades definidas | M0-T06, testes de recursos, E2E Class395 e 30 reinícios |

Correções da integração: compra duplicada, falta de verificação de propriedade, parsing conjunto dos saves, unidades de velocidade, apito `british`, material de fumaça expirado e retenção da composição longa. IDs, modelos, preços e multiplicador do Class395 foram preservados.

## Contrato implementado da loja

| API | Comportamento |
| --- | --- |
| `ShopState(storage)` | Lê independentemente recorde, saldo, trens adquiridos e seleção; não reescreve durante load |
| `buy(trainId)` | Booleano; valida ID próprio, propriedade e saldo; debita uma vez |
| `equip(trainId)` | Booleano; somente adquirido; persiste seleção; não modifica o perfil da tentativa ativa |
| `awardPoints({eventId, amount})` | Booleano; inteiro positivo seguro e evento único; escritor único de crédito. Identidade/estado da tentativa são validados pela sessão antes da chamada |
| `saveBest(score)` | Persiste recorde quando melhora, em resultado válido |
| `getTrainGameplayProfile(trainId, level)` | Perfil congelado: ID, carros, multiplicador, apito, velocidades m/s, aceleração m/s² e tempo de troca em segundos |
| `snapshot()` | Cópia de saldo, recorde, seleção, propriedade e falha de storage |

As chaves continuam `acrobatic_train_best`, `acrobatic_train_bank_points`, `acrobatic_train_unlocked_trains` e `acrobatic_train_current_train`.

Infinito: limite numérico corresponde ao km/h anunciado na loja, convertido no catálogo para m/s; início de 65% do limite e aceleração de 0,35 m/s². `speedBoost` não é aplicado novamente sobre os 95 km/h. Campanha normaliza todos os modelos para 14→18 m/s. Multiplicadores afetam pontuação casual, não chegada.

Ownership: catálogo/modelos pertencem a `train-factory.js`; `shop-state.js` escreve os saves legados; sessão/estado controlam tentativa e runId; módulos físicos calculam contato/movimento; HUD/dialogs apresentam; coordenador e `scene/resources.js` descartam recursos. Listeners de input/dialogs têm dispose; reinício não recria seus controladores. Encerramento da página descarta renderer, áudio, recursos e requisições; bfcache preserva a instância.

## M1 — aceites

| Aceite | Resultado | Evidência |
| --- | --- | --- |
| M1-A01 | Aprovado: pausa por causas independentes; movimento bloqueado em menu/resultado/loja | M1-T01; E2E pausa→loja→fechar→movimento |
| M1-A02 | Aprovado: passo 1/60 s, RNG de conteúdo independente e replay igual a 30/60/120 FPS | M1-T02, fixtures, retry no navegador |
| M1-A03 | Aprovado: colisão antes da chegada; conclusão única; sem bônus de chegada | M1-T03; chegada sem score no domínio e E2E de 600 m |
| M1-A04 | Aprovado: runId invalida callback antigo; crash usa tempo da simulação; retry preserva compras | M1-T04; E2E de resposta atrasada, crash, retry e reload |
| M1-A05 | Aprovado: fase jogável sem compra/IA | Fixture/replay cyber sem inputs; E2E com API bloqueada e chegada de steam/Class395 |
| M1-A06 | Aprovado no escopo: física sem DOM, HUD/drift throttled, interpolação sem alterar estado e recursos com proprietário | Testes de HUD/recursos; inspeção; 30 reinícios |
| M1-A07 | Aprovado: infinito acessível e sem chegada de campanha após 600 m | M1-T07; replay E2E alcançou 650,31 m em `playing`, `levelId=null` |

## Execução e evidências

- `npm test`: **25 testes passaram**, zero falhas. Quatro são os testes estáticos existentes; 21 verificam comportamento. Não foram usados resultados de demo Jev como prova de gameplay.
- `node --check`: todos os JavaScript de `src/`, `tests/` e `scripts/` passaram.
- E2E: desktop 1366×768, touch 390×844, Class395 de 12 carros e wall clock em 480×768; zero erros de página nos cenários com coletor de erros.
- Após cinco ciclos de aquecimento, os 30 seguintes mantiveram **57 geometrias e duas texturas** em pontos equivalentes renderizados. A medição amostrada não prova ausência de todo tipo de vazamento em cenas futuras.
- GPU: software/SwiftShader. Sombras foram desativadas apenas no cenário de wall clock para reduzir seu custo. Não há prova de FPS de hardware.
- [Resultado principal](../../artifacts/validation/m0-m1-final-20261006/browser-results.json), [contadores dos reinícios](../../artifacts/validation/m0-m1-final-20261006/restart-memory.json), [wall clock](../../artifacts/validation/m0-m1-final-20261006/wall-clock.json).
- [Resultado do infinito](../../artifacts/validation/m1-infinite-20261006/browser-results.json), [snapshot do replay](../../artifacts/validation/m1-infinite-20261006/infinite-replay.json).
- Após a revisão visual, o cabeçalho mobile foi reorganizado para manter apito/pausa/som alcançáveis. Menu e pausa têm botões de acesso à loja. [Revalidação da interface](../../artifacts/validation/m0-m1-ui-final-20261006-r2/browser-results.json) aprovada em desktop/mobile, com taps nos controles móveis.
- Capturas finais: [desktop em jogo](../../artifacts/validation/m0-m1-ui-final-20261006-r2/desktop-playing.png), [desktop resultado](../../artifacts/validation/m0-m1-ui-final-20261006-r2/desktop-result.png), [mobile em jogo](../../artifacts/validation/m0-m1-ui-final-20261006-r2/mobile-playing.png), [mobile resultado](../../artifacts/validation/m0-m1-ui-final-20261006-r2/mobile-result.png).
- [Manifesto local](../../artifacts/evidence.json). Evidências são locais, sintéticas e sem credenciais/dados reais de sessão.

Durante o teste foram corrigidos a amostragem de recursos antes de frames equivalentes e o uso do próprio quaternion como origem/destino da interpolação. A interpolação agora usa cópia da orientação atual e restaura o estado mesmo se o render lançar erro. O banner do apito foi afastado do progresso da fase.

## Reprodução

```powershell
npm test
# Se Playwright não estiver instalado no projeto:
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser
```

O harness cria servidor local, contextos e saves sintéticos, bloqueia IA e encerra servidor/browser ao terminar. A instrumentação só existe com `window.__TRAIN_TEST_CONFIG__` definida antes do jogo. `TEST_SCOPE=ui`, `resources`, `clock` ou `infinite` isola cenários; sem escopo executa todos. Cada execução recebe diretório próprio em `artifacts/validation/`.

## Limites

Não houve playtest humano, teste de leitor de tela, medição em aparelho físico ou scorecard de release. Capturas foram inspecionadas; os resultados automatizados não são certificação de acessibilidade/desempenho. A configuração de cena e parte das acrobacias ainda são coordenadas em `game.js`; futuras extrações devem ser incrementais.

O navegador preserva o Three.js r128 carregado pelo HTML; testes Node usam a dependência Three declarada no projeto. O E2E confirma as operações críticas no runtime real do navegador. Não foi feita migração de versão nesta entrega.

M2 deve entregar barreiras da fase 1, fases 2–3, mapa/desbloqueio e save de campanha. Esta entrega não libera fase 2, concede troféu ou implementa multiplayer/mods.
