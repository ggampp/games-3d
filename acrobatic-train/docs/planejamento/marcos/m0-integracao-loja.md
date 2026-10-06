# M0 — Integração da Train Shop

Status: planejado. Dependência: entrega do outro agente. Próximo: [M1](m1-base-campanha.md). Referências: [contratos](../CONTRATOS.md), [testes](../TESTES.md).

## Objetivo e fronteira

Estabilizar as interfaces que a campanha consome sem recriar a loja. O responsável pela Train Shop entrega catálogo, compra, equipamento, saldo, modelos e seus testes. A integração recebe essas interfaces e registra suas unidades e restrições. Não editar simultaneamente `game.js`, `hud.js`, `keyboard.js`, `train-factory.js`, `index.html` e `index.css` durante a entrega da loja.

## Pré-requisitos

- Inventário final de arquivos e comportamento entregue, incluindo políticas de compra/equipamento.
- Snapshot dos quatro formatos atuais de save, com valores fictícios; sem exportar dados de sessão.
- Catálogo contém o trem gratuito e os quatro preços pedidos: 50, 100, 1.000 e 2.000 pontos.
- Definir quem é o único escritor da economia e quem mantém os arquivos compartilhados após a integração.

## Tarefas na ordem de execução

1. Comparar a entrega final com o plano: nomes dos trens, composição, saldo inicial, apito, multiplicador e velocidade numérica. Resolver diferença entre textos da loja e unidades reais.
2. Formalizar `getTrainGameplayProfile`, evento de equipamento e operação de crédito idempotente, usando um adaptador se a loja já oferece outros nomes. Documentar o contrato final sem duplicar dados.
3. Registrar aquisição e equipamento como operações distintas. Equipamento de trem bloqueado deve ser recusado pelo domínio, mesmo se o botão estiver escondido.
4. Integrar snapshot do equipamento no briefing da campanha: consulta de loja em pausa é possível; equipamento entra na próxima tentativa. M1 implementa as causas de pausa.
5. Testar save legado; migrar só se necessário, preservando recorde, saldo, propriedade e seleção.
6. Compartilhar a definição de perfil normalizado da campanha e do multiplayer. Não aplicar textos como “95 km/h” como número de física.
7. Consolidar código legado de seleção de skin apenas após a entrega. Registrar bugs de compra repetida, uso de recursos ou apito em backlog do dono da loja.
8. Criar testes de integração da economia/equipamento e smoke E2E. Guardar a evidência da regressão antes de M1.

## Entregáveis

Contrato de integração versionado; fixtures de save/perfil; adaptadores mínimos se necessários; `tests/shop-integration.test.js` proposto; relatório da regressão. M0 não implementa fases nem altera os preços por balanceamento.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M0-A01 | Um catálogo e um escritor de saldo; unidade dos atributos e total de carros explícitos |
| M0-A02 | Quatro saves legados carregam sem perda; save inválido tem recuperação segura |
| M0-A03 | Comprar uma vez debita o preço uma vez; crédito duplicado não duplica ganho |
| M0-A04 | Equipamento válido chega ao perfil; bloqueado é recusado; troca em campanha não modifica tentativa ativa |
| M0-A05 | Teclado/touch, apito, loja e reinício seguem funcionando após integração |
| M0-A06 | A composição de 12 carros tem contrato de retenção/recursos; nenhum arquivo da loja fica sem responsável |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M0-T01 / unitário | Todos os IDs do catálogo → obter perfis | IDs únicos, números finitos, unidades corretas, composição positiva; nenhuma segunda fonte de preço/saldo | M0-A01 |
| M0-T02 / integração | Fixtures com saldo 0/50/2.000, trens adquiridos e save JSON inválido → carregar | Valores válidos preservados; inválido recupera sem apagar outras chaves válidas | M0-A02 |
| M0-T03 / domínio | Saldo exato de 50 → comprar steam duas vezes; creditar mesmo `eventId` duas vezes | Saldo final não negativo; propriedade única; segundo débito/crédito não aplicado | M0-A03 |
| M0-T04 / integração | Tentativa com cyber ativa → equipar adquirido; tentar ID bloqueado/inexistente | Perfil ativo inalterado; próximo briefing usa adquirido; bloqueados/inexistentes recusados | M0-A04 |
| M0-T05 / E2E | Sessão desktop/touch → comprar, equipar no briefing, iniciar, apitar, pausar, reiniciar | Modelo/apito correspondente; controles respondem; compras sobrevivem ao retry | M0-A05 |
| M0-T06 / inspeção e integração | Class395 equipado → medir offsets da cauda e registrar propriedade dos recursos | `totalCars=12` no contrato acordado; retenção cobre offset máximo; matriz de responsáveis e descarte definida | M0-A06 |

## Gate de saída e riscos

Todos os M0-A passam; interfaces e unidades são estáveis; dados antigos preservados. A presença da interface no código não aprova M0 sem execução. Se a loja ainda estiver mudando, preparar fixtures/configurações puras e aguardar sua entrega para integrar. Não criar uma loja alternativa para contornar a dependência.
