# M2 — Fases 1–3, progresso e interface da campanha

Status: planejado. Dependência: [M1](m1-base-campanha.md). Próximo: [M3](m3-fases-medias.md). Conteúdo: [1](../fases/fase-01.md), [2](../fases/fase-02.md), [3](../fases/fase-03.md).

## Objetivo

Entregar a progressão fácil completa, com seleção, continuar, save e três habilidades: desviar, evitar trilhos rompidos e usar rampas. O usuário pode avançar sem atingir pontuação mínima.

## Tarefas na ordem de execução

1. Criar `progress-store.js` com validação/versionamento e storage injetável. Separar conclusão oficial, melhores resultados e troféus; preservar chaves da loja.
2. Implementar seleção/continuar e bloqueio de fase tanto na UI quanto no domínio. Fases 4–9 aparecem indisponíveis até sua entrega.
3. Implementar barreira estática com volume visível e aviso; concluir conteúdo completo da fase 1.
4. Parametrizar lacunas por fase; implementar encontros da fase 2 e garantir caminho para ambos os truques.
5. Corrigir coleta por altura e confirmar salto/pouso existentes. Implementar fase 3 com rampas opcionais e postes isolados.
6. HUD: fase, distância restante/progresso, objetivo curto, score e saldo como informações distintas. Não duplicar a UI da loja.
7. Resultado: fase concluída, pontos/tempo, próxima/repetir/mapa. Persistir antes de oferecer avanço; em falha de storage manter progresso em memória com aviso.
8. Ajustar foco dos modais, teclas e touch; sinais de sucesso/reinício com áudio respeitando mute.
9. Criar fixtures, replays e testes F01–F03; executar aceites C-01 a C-10 e playtest fácil.

## Entregáveis propostos

Save `acrobatic_train_campaign_v1`; `campaign-ui.js`; três configurações/rotas; barreira estática; teste de altura; `tests/progress-store.test.js`, `campaign.test.js` e `level-content.test.js`. Não há troféu final antecipado nem novos bônus de chegada.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M2-A01 | Novo save libera só fase 1; 1→2→3 por chegada e continua após reload |
| M2-A02 | Save válido/legado da campanha migra; corrupção/storage indisponível não bloqueiam jogo nem apagam loja |
| M2-A03 | Fases 1–3 passam seus aceites locais e todos C-01 a C-10 |
| M2-A04 | Coleta aérea não ocorre ao passar no chão; pouso e postes respeitam alturas |
| M2-A05 | HUD, mapa, briefing e resultado funcionam em teclado/touch e preservam foco |
| M2-A06 | Retry/replay preservam compras e melhor progresso; score zero não impede avanço |
| M2-A07 | Playtest confirma compreensão das três habilidades; balanceamento e evidência registrados |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M2-T01 / domínio e E2E | Save novo → tentar 3 → concluir 1 e 2 → reload | 3 inicialmente recusada; desbloqueio sequencial; continuar seleciona fase liberada apropriada; 4 indisponível | M2-A01 |
| M2-T02 / unitário | Versão suportada antiga, campos ausentes/fora de faixa, JSON quebrado e storage que lança → load/save | Migração válida; inválidos recuperados; UI avisa erro; compras/recorde sem alteração | M2-A02 |
| M2-T03 / integração | Três fixtures finais → rodar todos os TC e F01/F02/F03 | Todos passam; relatório por fase/perfil/seed | M2-A03 |
| M2-T04 / física | Mesmo item aéreo → atravessar em y de solo e y de contato; pousar em via livre/poste | Zero coleta no solo; uma coleta em altura; pouso livre válido; contato real com poste derrota | M2-A04 |
| M2-T05 / E2E | Navegação sem mouse e touch retrato/paisagem → selecionar, jogar, resultado | Foco entra/sai corretamente; progresso limitado a 0–100%; botões e HUD sem sobreposição vital | M2-A05 |
| M2-T06 / integração | Save com compras → concluir com score 0 → repetir e perder | Fase seguinte liberada; compras e progresso máximo mantidos; zero bônus de chegada | M2-A06 |
| M2-T07 / humano | Jogador aprende 1–3 em desktop/touch → registrar entendimento e derrotas | Reconhece desvio/gap/rampa; aviso não depende só de cor; ajustes documentados com rotas rerodadas | M2-A07 |

## Gate de saída

Três fases concluídas, aceites por fase rastreados, save resistente e interface completa. Se a coleta aérea ainda estiver incorreta, a fase 3 não pode ser aceita por aparência. O progresso da campanha não depende da ferramenta semântica Jev.
