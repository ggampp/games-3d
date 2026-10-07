# Contratos comuns de implementação e conteúdo

Status: contratos aplicados à implementação M0/M1/M2; partes futuras e avaliação humana permanecem previstas nos respectivos marcos. Aplicável a [todos os marcos e fases](README.md). Mudanças de contrato devem atualizar os documentos afetados e seus fixtures antes de retomar o balanceamento.

## 1. Unidades e configuração

- Distância longitudinal `s` em metros; tempo em segundos de simulação; velocidades em m/s. HUD apresenta km/h multiplicando por 3,6.
- Vias lógicas: `L`, `C`, `R`, convertidas para `-TRACK_SPACING`, `0`, `TRACK_SPACING`. Não misturar índice lógico e deslocamento lateral nos dados.
- `lengthM` é a coordenada da chegada medida pela posição de referência da locomotiva. A extensão do trem não adia a vitória nesta versão.
- `startSpeedMps`, `maxSpeedMps`, `accelerationMps2`, `crossTimeS`, `seed`, `contentVersion` e `encounters` são explícitos. Aceleração inicial proposta: 0,35 m/s²; mudança de uma via: 0,28 s, a validar contra os perfis integrados em M0.
- Seed: `acrobatic-campaign-v1-01` até `acrobatic-campaign-v1-09`; a função de conversão e o algoritmo de RNG têm versão e testes. RNG de fumaça/câmera/áudio não altera layout.
- Zona segura inicial: `[0,80)`. Zona segura final: `[lengthM-80,lengthM]`. Nenhum volume de perigo, inclusive móvel, pode invadir essas zonas. Itens opcionais são permitidos se não esconderem avisos.
- Percurso renderizado existe além da chegada e atrás de toda a composição. Proposta: margem final mínima de 100 m e retenção traseira `maxOffsetDosVagoes + margem`; calcular a margem pela interpolação e visibilidade da câmera, não por um número fixo de 60 m.

Dados propostos por encontro: `id`, `startM`, `endM`, famílias, vias ocupadas, envelope de altura, trajetória/ciclo se móvel, aviso, estados de entrada/saída alcançáveis e referência à rota de teste. As faixas dos roteiros são envelopes reservados, não um comando para preencher toda a faixa com colisores.

## 2. Orçamento de reação e dificuldade

| Grupo | Reação humana inicial | Aviso desejado inicial | Descanso após encontro, em tempo na velocidade máxima |
| --- | --- | --- | --- |
| Fases 1–3 | 1,40 s | Pelo menos 2,50 s | Pelo menos 2,50 s |
| Fases 4–6 | 1,00 s | Pelo menos 2,00 s | Pelo menos 2,00 s |
| Fases 7–8 | 0,70 s | Pelo menos 1,60 s | Pelo menos 1,60 s |
| Fase 9 | 0,45 s | Pelo menos 1,20 s | Pelo menos 1,20 s |

Esses valores são hipóteses; a tabela não autoriza encontros impossíveis. Para um encontro que exige `k` mudanças sequenciais de via, usar aviso mínimo de `max(avisoDoGrupo, reação + k*crossTimeS + 0,15 s)`, acrescido de qualquer tempo de pouso/alinhamento obrigatório. Movimentos simultâneos só reduzem `k` se a rota de referência e os controles humanos o demonstrarem.

Converter tempo em distância na velocidade máxima da fase e somar o avanço longitudinal do colisor dianteiro. Calcular o primeiro contato com o volume, não seu centro. Confirmar em câmera desktop e mobile que o aviso realmente ficou legível pelo tempo exigido. Se o espaço reservado não comportar o orçamento, mover ou remover o encontro; não reduzir o aviso silenciosamente.

Cada encontro deve ter ao menos uma saída alcançável a partir da entrada real do encontro anterior. A rota de referência precisa considerar os dois truques, elevação, estado de salto e pouso. O validador testa tanto o encontro isolado quanto sua ligação com o seguinte, inclusive fronteiras entre segmentos.

## 3. Simulação, chegada e pontuação

- Passo fixo inicial: 1/60 s; renderização interpola. Após suspensão da aba, limitar o acúmulo e pausar localmente em vez de saltar perigos. O limite de catch-up deve ser configurado e testado.
- Ordem de um passo: consumir comandos válidos → movimento/obstáculos → colisão/coleta → se vivo, chegada → emitir eventos/snapshot. Colisão no passo da chegada impede vitória.
- Slow motion inicial de campanha é visual. Não muda ciclos, física ou tempo de conclusão. O modo infinito pode preservar comportamento casual separado.
- Colisão inicial: locomotiva e dois truques. Vagões são seguidores visuais; não colidem, não coletam nem acionam chegada.
- Separar pontuação determinística, pontuação casual com IA e saldo persistido. Nunca usar bônus assíncrono para desbloquear uma fase ou desempatar corrida.
- Não adicionar recompensa por concluir fase nesta versão. Cada coleta/manobra válida passa pelo único escritor da economia; eventos duplicados não duplicam saldo.
- Save oficial: `acrobatic_train_campaign_v1`, com versão, progresso e troféus. Resultado de mod ou online não escreve esse progresso oficial no MVP.

## 4. Loja, tentativas e sobreposições

Preservar as quatro chaves existentes da loja/recorde. Não migrar ou renomear sem teste de compatibilidade. Catálogo e escritor de saldo pertencem à integração da Train Shop.

Perfil de trem proposto: `{trainId, totalCars, gameplay:{...atributosNumericosComUnidades}, visual:{...}}`. A campanha pode normalizar atributos por fase para garantir que o trem gratuito vença. Capturar o perfil no briefing; equipamento novo vale na próxima tentativa.

Cada tentativa tem `runId` único e cada evento econômico tem `eventId` único. Não usar apenas distância como ID. Ao sair/reiniciar/concluir, invalidar respostas da IA, timers, comandos pendentes e listeners transitórios. Requisição anterior não pode alterar uma tentativa nova.

Pausa usa causas independentes: pausa manual e modais bloqueantes. Fechar loja não remove a pausa manual. Teclas de gameplay não atravessam seleção, resultado ou loja. Em rede, modal e pausa local não param a sala.

## 5. Aceites comuns obrigatórios para as nove fases

| ID | Aceite objetivo | Teste na [estratégia compartilhada](TESTES.md) |
| --- | --- | --- |
| C-01 | Configuração válida; unidades, limites e zonas seguras respeitados | TC-01 |
| C-02 | Seed produz o mesmo conteúdo e replay, independentemente do FPS e dos efeitos | TC-02 |
| C-03 | Ao menos uma rota completa demonstrada com o trem gratuito e todos os perfis habilitados | TC-03 |
| C-04 | Colisões precedem vitória; chegada concede uma conclusão e não gera bônus extra | TC-04 |
| C-05 | Retry reinicia só a tentativa; pause/reload/overlays preservam as regras | TC-05 |
| C-06 | Resposta/timer de outro `runId` não altera estado, pontuação ou saldo | TC-06 |
| C-07 | Controles e avisos legíveis em teclado/touch e dois formatos de tela | TC-07 |
| C-08 | Transições e reinícios não acumulam recursos, timers ou listeners | TC-08 |
| C-09 | Fase respeita desbloqueio e preserva save/compras; nenhuma pontuação mínima obrigatória | TC-09 |
| C-10 | Colisores, alertas e coleta aérea correspondem ao volume visual; sem dependência de IA | TC-10 |

Um caminho de referência aprovado verifica a simulação, mas não demonstra diversão ou dificuldade apropriada. Playtest humano é aceite adicional para cada fase.

## 6. Registro de conclusão

Para cada aceite guardar: ID, versão do código/conteúdo, fixture/seed, trem, ambiente, resultado e caminho da evidência. Se um valor numérico mudar, rerodar os testes de conteúdo/rotas afetados e atualizar o documento da fase. Nenhum aceite pode ser aprovado apenas por screenshot ou presença de string no código.
