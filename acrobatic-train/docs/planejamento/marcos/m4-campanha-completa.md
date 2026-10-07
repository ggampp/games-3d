# M4 — Campanha completa, desafio final e troféu

Status: implementado em 07/10/2026; validação automatizada aprovada; gate humano M4-A07 e orçamento de frame time em hardware (parte de M4-A06) pendentes. [Relatório por aceite](../VALIDACAO_M4.md). Dependência: [M3](m3-fases-medias.md). Próximos independentes: [M5](m5-multiplayer.md) e [M6](m6-mods.md). Conteúdo: [7](../fases/fase-07.md), [8](../fases/fase-08.md), [9](../fases/fase-09.md).

## Objetivo

Concluir a versão solo com nove fases, dificuldade progressiva, troféu persistente e modo infinito independente. A final é difícil e solucionável; não haverá meta estatística de taxa de conclusão derivada da expressão da transcrição.

## Tarefas na ordem de execução

1. Compor fases 7–8 com famílias já implementadas, no máximo duas por encontro nesta primeira campanha. Reduzir descanso apenas dentro dos budgets comuns.
2. Autorizar cada encontro da fase 9 manualmente; não sortear perigos sem validar conexões. Usar rota canônica sem exigir compra/IA.
3. Gerar replays por fase e por perfil habilitado. Rodar no limite de velocidade e em variações de FPS; corrigir conexões que exigem controle impossível.
4. Implementar conclusão persistente das nove fases e conquista `campaign-9-complete`. Reprocessar conclusão/callback não duplica o troféu.
5. Criar tela de campanha completa e galeria simples; comemoração respeita mute, foco e preferência por movimento reduzido. Oferecer repetir, mapa e infinito.
6. Implementar continuar/replay de fases concluídas sem regressão de desbloqueio; mods/online não escrevem troféu oficial.
7. Executar fluxo completo 1→9, reload em pontos intermediários e retorno ao infinito. Verificar recorde, saldo e propriedade da loja ao longo do fluxo.
8. Medir recursos/desempenho no pior cenário visual incluindo fumaça/composição longa; diminuir orçamento visual se necessário sem mudar regras físicas.
9. Playtest de dificuldade e clareza; atualizar configurações/replays/documentos após qualquer ajuste.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M4-A01 | Fases 7–9 passam seus testes locais e C-01 a C-10 |
| M4-A02 | Campanha inteira vence com cyber; compras, pontos mínimos e API não são requisitos |
| M4-A03 | Troféu só após nove conclusões oficiais válidas, uma concessão, persistente após reload |
| M4-A04 | Vitória final tem navegação/foco/áudio corretos; retry da 9 não duplica conquista |
| M4-A05 | Infinito e conteúdo não oficial não alteram progresso/troféu oficial |
| M4-A06 | Perfis e composição longa aprovados; recursos e desempenho cumprem budgets registrados |
| M4-A07 | Playtest distingue dificuldade de falha de leitura e registra ajustes |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M4-T01 / conteúdo | Fixtures 7–9 → TC-01 a TC-10 e F07/F08/F09 | Todos passam com relatório por perfil/seed; final tem rota reproduzível | M4-A01 |
| M4-T02 / integração e E2E | Save novo/cyber/API offline → completar 1→9 com rotas | Progressão completa sem compras; fases concluem mesmo com score 0; telas e save coerentes | M4-A02 |
| M4-T03 / persistência | Save com 8 conclusões → tentar troféu; concluir 9; duplicar evento; reload | Ausente antes de 9; um ID de troféu depois; persistência correta e contador de concessão único | M4-A03 |
| M4-T04 / E2E | Vitória 9 → navegar galeria/mapa/repetir usando teclado/touch com mute | Foco visível e restaurado; nenhum áudio quando mute; replay sem duplicação de troféu | M4-A04 |
| M4-T05 / integração | Concluir infinito/mod/online com distância maior que 1.500 m | Nenhum desbloqueio/troféu oficial; saves/escopos separados | M4-A05 |
| M4-T06 / desempenho e recursos | Todos os perfis; Class395 e steam; 30 ciclos e 60 s do pior cenário | Cauda com trilhos; recursos estáveis; budgets de frame time cumpridos em ambiente registrado | M4-A06 |
| M4-T07 / humano | Sessão desktop/touch das difíceis/final → registrar derrotas e tentativa seguinte | Jogador consegue explicar causa e correção; nenhuma dificuldade aceita por obstáculo oculto; ajustes rastreados | M4-A07 |

## Gate de saída

Nove fases e campanha solo completas com relatório dos aceites, conquistas persistentes e regressão da loja. A palavra “concluído” exige evidência, não apenas todos os arquivos de configuração escritos. Publicação e push não fazem parte deste marco sem pedido posterior.
