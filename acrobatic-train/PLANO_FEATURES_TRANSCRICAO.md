# Plano de features — Acrobatic Train

Data: 06/10/2026. Base: `transcricao_audio_trem.md`, documentação e código disponíveis nesta leitura.

Atualização de implementação em 07/10/2026: M0/M1 validadas; M2 e M3 implementadas com validação automatizada aprovada; playtests humanos pendentes. [Relatório M3](docs/planejamento/VALIDACAO_M3.md), [relatório M2](docs/planejamento/VALIDACAO_M2.md). [Resultados, contratos e evidências](docs/planejamento/VALIDACAO_M0_M1.md). As seções abaixo preservam a proposta geral e o retrato da leitura inicial.

Status: planejamento, sem implementação das features. A Train Shop está sendo criada por outro agente; os contratos descritos aqui são propostas para integrar os trabalhos após a entrega da loja. O checkout pode mudar durante esse trabalho paralelo.

Detalhamento: [índice das etapas de implementação e das nove fases jogáveis](docs/planejamento/README.md), com arquivos separados, aceites e casos de teste. O inventário e os resultados da seção 11 abaixo são o retrato da primeira leitura; o índice detalhado registra atualizações posteriores, incluindo a presença de `tests/architecture-spec.test.js`.

## 1. Objetivo e escopo

Transformar a corrida infinita atual em uma campanha de nove fases: três fáceis, três médias, duas difíceis e uma final extremamente desafiadora. Cada fase apresenta obstáculos ou combinações novas; completar a nona concede um troféu persistente. Preservar o modo infinito como opção independente.

Depois da campanha, acrescentar multiplayer e um sistema de pacotes de conteúdo. O usuário confirmou que “365 mods” significa **suporte a mods e expansão gradual do catálogo**. Não há compromisso de produzir 365 pacotes nesta primeira entrega.

A transcrição pede dificuldade “impossível”, mas a proposta é uma fase final difícil e solucionável. A expressão “0.00001 pessoas” não define uma probabilidade verificável; o percentual apresentado no resumo da transcrição não será usado como meta de balanceamento.

## 2. O que existe hoje

| Área | Evidência no código | Implicação para o plano |
| --- | --- | --- |
| Gameplay | `src/core/game.js`: três vias, controle separado dos truques dianteiro e traseiro, alinhamento, aceleração, drift, rampas, giro e backflip | Reutilizar os controles e as manobras |
| Percurso | `pathAt`, `addSeg`, `placeHazards`, `maintainTrack`: segmentos contínuos e geração com `Math.random()` | Acrescentar percurso finito/configuração por fase e aleatoriedade reproduzível |
| Obstáculos | `PATTERNS`: rampas, lacunas nos trilhos, postes, itens e itens diagonais | Criar variação por fase e novas famílias de obstáculos |
| Pontuação | `addPoints`: pontuação da tentativa e saldo da loja recebem os mesmos ganhos, com multiplicador do trem | Separar métricas da campanha da economia, mantendo uma única autoridade para o saldo |
| Persistência | `localStorage` guarda recorde, saldo, trens liberados e trem equipado | Acrescentar progresso e troféu com versionamento sem sobrescrever a loja |
| Train Shop | Catálogo, compra, equipamento, modal e modelos já aparecem em `game.js`, `hud.js`, `keyboard.js`, `train-factory.js` e HTML/CSS | Presença no código não comprova que o trabalho do outro agente está concluído |
| Composições | `applyTrainModel` cria vagões seguidores; catálogo inclui composição de 12 carros | Manter a regra de colisão consistente entre trens e preservar trilhos atrás da cauda |
| HUD | `HudManager.update` limita atualizações a intervalos de 80 ms | Reutilizar a abordagem e estendê-la aos indicadores de campanha |
| Áudio | `src/core/audio.js`: sons procedurais com Web Audio | Reutilizar para conclusão de fase, alertas e troféu |
| Backend | `scripts/serve.js`: arquivos estáticos e `POST /api/stunt-judge` | Ainda não oferece salas ou simulação multiplayer |
| Fases/vitória/mods | Não foram encontrados gerenciador de campanha, condição de chegada, troféu, protocolo multiplayer ou carregador de mods | Sistemas novos |

O README concentra-se nas ferramentas Jev. A separação em `scene/`, `physics/` e `audio/` está prevista no AGENTS.md, mas esses diretórios não aparecem no inventário atual: grande parte do jogo continua em uma IIFE em `src/core/game.js`, e o áudio está em `src/core/audio.js`.

### Pontos que afetam as features

1. **Pausa e sobreposições:** `toggleStore` e `togglePause` compartilham `mode = 'paused'` sem registrar a causa. Fechar a loja pode retomar uma pausa anterior, e a tecla de pausa pode retomar o jogo com a loja aberta. Campanha precisa de regras explícitas para esses estados.
2. **Bônus tardios:** `evaluateStuntWithJev` aplica pontos após um `fetch`, sem associar a resposta à tentativa que originou a manobra. Uma resposta pode chegar depois de derrota, reinício ou troca de fase. O timeout de derrota também não tem identificador da tentativa.
3. **Coleta aérea:** `checkHits` verifica a projeção longitudinal/lateral dos itens, mas não compara a altura do item à altura do trem. Corrigir isso antes de exigir saltos para missões ou recompensar coleta aérea.
4. **HUD do drift:** `updateDriftCombo` altera texto e largura por frame, apesar do throttle do HUD principal. Estender a atualização por estado/throttle a esse indicador.
5. **Trilhos atrás da composição:** `TRACK_BEHIND = 60`, enquanto os seguidores usam `index * (CAR_LEN + 0.5)`. A composição longa ultrapassa essa retenção. Dimensionar o histórico pela cauda mais uma margem; garantir percurso inicial suficiente para todos os carros.
6. **Velocidade da loja:** `speedBoost` existe no catálogo, mas a atualização de velocidade usa as constantes globais; textos de velocidade em km/h também não são os limites da simulação em m/s. Resolver o contrato de atributos com o agente da loja antes de calibrar fases.
7. **Recursos:** há descarte de geometrias dos segmentos e dos modelos ao trocar trem. A expiração de uma partícula de fumaça descarta sua geometria, mas não o material clonado. Há materiais compartilhados em vagões. Revisar propriedade/descarte único de recursos antes de multiplicar transições de fase, em coordenação com o agente da loja.
8. **Código legado:** existem duas declarações de `cycleSkin`; a anterior referencia `applyTrainSkin`, ausente no arquivo. A checagem sintática passou, mas essa duplicidade dificulta manutenção. Consolidar somente após integrar a entrega da loja.
9. **Reprodutibilidade:** o passo usa delta variável limitado, e efeitos e percurso compartilham `Math.random()`. Campanha reproduzível e multiplayer precisam de configuração, RNG e relógio de simulação separados dos efeitos visuais.

Esses achados são de leitura estática; não foram reproduzidos no navegador nesta tarefa.

## 3. Regras da campanha

### Fluxo do jogador

Menu → Campanha → mapa de fases → briefing curto → jogar → resultado → próxima fase ou repetir. Ao concluir a fase 9: celebrar vitória, conceder troféu e mostrar a campanha completa.

- Apenas a fase 1 começa liberada. Completar uma fase libera a seguinte.
- O jogador pode repetir fases concluídas e continuar da última fase liberada após recarregar.
- A fase termina ao atravessar a chegada vivo, usando a posição de referência da locomotiva. Pontuação é objetivo opcional; não bloqueia a progressão inicial.
- Não colocar obstáculos na zona de chegada. Processar colisões do passo antes de conceder vitória; uma colisão no mesmo passo prevalece sobre a chegada.
- Derrota permite reiniciar a fase atual, sem perder desbloqueios, compras ou troféus.
- Cada tentativa reinicia distância, velocidade, movimentos, salto, combo, obstáculos e métricas; mantém os dados persistentes.
- O trem gratuito deve conseguir completar as nove fases. A compra de trens não será requisito para vencer.
- A regra inicial de colisão usa a locomotiva e seus dois truques. Vagões seguidores são visuais em todos os modelos; colisão de toda a composição seria uma feature posterior, com novo balanceamento.
- Em campanha, trocar trem somente no briefing/resultado. A loja pode ser consultada durante a tentativa pausada, mas o novo equipamento entra na tentativa seguinte. Essa regra precisa ser integrada à loja.
- Manter o modo infinito separado: não libera fases nem concede o troféu da campanha.

### Estados e eventos propostos

Estados da tentativa: `ready`, `playing`, `paused`, `crash`, `over`, `levelComplete`, `campaignComplete`. Tela atual, abertura de modal e motivo da pausa são dados separados; nenhum botão pode retomar uma simulação enquanto outra sobreposição a bloqueia. Fechar uma loja aberta durante uma pausa manual preserva a pausa.

Eventos: `runStarted`, `pointsEarned`, `stuntLanded`, `playerCrashed`, `levelCompleted`, `campaignCompleted`, `trainEquipped`. Cada evento relevante traz `runId`, `levelId`, origem e identificador único. Conclusão, recompensa e troféu devem ser idempotentes.

Toda nova tentativa incrementa `runId`. Cancelar requisições/timeouts anteriores quando possível e rejeitar resultados cujo `runId` não corresponde ao atual. Após a tentativa terminar, nenhum bônus assíncrono altera pontuação ou saldo. A política para respostas durante pausa deve ser explícita: enfileirar para a retomada, descartando se a tentativa terminar.

## 4. Proposta das nove fases

Os números abaixo são valores iniciais para playtest. Distâncias estão em metros e velocidade de simulação em m/s. O HUD converte para km/h. Comprimento e velocidade devem produzir tentativas curtas; medir o tempo real antes de fechar os valores.

| Fase | Dificuldade / tema | Comprimento | Velocidade inicial → limite | Introdução e desafio |
| --- | --- | --- | --- | --- |
| 1 | Fácil — Saída da estação | 600 m | 14 → 18 | Itens no chão e barreira fixa em uma via; ensinar desviar/alinhar com área inicial segura |
| 2 | Fácil — Trilhos em reparo | 750 m | 16 → 21 | Lacunas curtas em uma via, avisadas; escolher a via segura |
| 3 | Fácil — Primeiro voo | 850 m | 18 → 24 | Rampas, coleta aérea opcional e postes espaçados; ensinar saltar e pousar |
| 4 | Média — Cancela ferroviária | 950 m | 20 → 27 | Cancelas temporizadas com aviso; escolher uma rota aberta |
| 5 | Média — Ponte de manobras | 1.100 m | 22 → 30 | Obstáculo com abertura central, postes e lacunas combinados; alinhar os dois truques |
| 6 | Média — Cruzamento em movimento | 1.200 m | 24 → 33 | Vagão de manutenção cruzando vias em trecho reto, depois sequências de rampa/desvio |
| 7 | Difícil — Sequência acrobática | 1.300 m | 26 → 36 | Menos descanso; combinações de até duas famílias por encontro, com rotas alternativas |
| 8 | Difícil — Corredor de precisão | 1.400 m | 28 → 39 | Janelas mais curtas para cancelar/desviar e alinhar; alternância entre os desafios anteriores |
| 9 | Extrema — Desafio final | 1.500 m | 30 → 42 | Sequência final autorada que combina tudo; rota solucionável demonstrada e chegada de vitória |

Rampas nas primeiras fases são oportunidades, sem coleta aérea obrigatória. A fase 9 deve ser ensaiável e consistente: dificuldade vem da execução de habilidades aprendidas, com boa visibilidade e sequência estável.

### Construção justa dos encontros

- Campanha utiliza sequências autoradas de encontros e variações com seed fixa por fase. A mesma tentativa reiniciada preserva o layout; o modo infinito pode continuar variando.
- Separar configuração física, layout e geometria. A geração não escolhe obstáculos isolados sem verificar as transições entre encontros.
- Cada encontro informa vias ocupadas, intervalo longitudinal, alturas, tempos ativos, aviso e estados válidos de entrada/saída dos dois truques.
- Calcular tempo disponível até o perigo a partir da velocidade máxima permitida; considerar tempo de reação mais o tempo das mudanças necessárias. `CROSS_TIME = 0.28` hoje é um ponto de partida, não o orçamento completo.
- Usar envelopes de movimento/colisão compatíveis com todos os trens liberados, sem depender da aparência do modelo. Validar caminhos para os dois truques, salto, pouso e cauda visual.
- Validar também fronteiras entre segmentos e entre encontros. Sempre existir pelo menos uma sequência alcançável desde o estado de saída anterior.
- Não gerar três vias simultaneamente bloqueadas sem uma solução previamente validada, como rampa acessível com salto suficiente e pouso livre.
- Avisos devem usar forma/texto e cor; neblina ou cenário não podem esconder a informação necessária. Obstáculos móveis aparecem primeiro em trechos retos para facilitar a leitura.
- Para cada fase, manter uma sequência de inputs de referência que chega ao final na simulação. Isso prova solucionabilidade no modelo; playtest humano verifica legibilidade e diversão.

## 5. Novas famílias de obstáculos

| Família | Regra / ação exigida | Implementação proposta | Critério de aceite |
| --- | --- | --- | --- |
| Barreira de obras | Bloqueia uma via; trocar de via | Volume estático em coordenadas do percurso | Volume visual e colisão coincidem; duas vias inicialmente livres |
| Cancela temporizada | Fecha uma via em ciclo previsível | Ciclo calculado por tempo da simulação e seed; indicador de fechamento | Congela na pausa; aviso oferece tempo suficiente; existe rota alternativa |
| Pórtico com abertura | Passar alinhado pela via indicada; diagonal colide com as laterais | Volumes laterais que deixam abertura real, incluindo verificação de altura | Alinhamento correto passa; contato lateral causa derrota; salto só passa se houver altura física suficiente |
| Vagão de manutenção | Cruza uma ou mais vias; antecipar desvio | Trajetória parametrizada e colisão contínua ou subpassos | Não nasce sobre o jogador; não atravessa o trem entre frames; movimento reproduzível |

Rampa, lacuna e postes permanecem reutilizáveis. Começar com barreiras estáticas; introduzir cada obstáculo móvel apenas depois que suas regras de colisão e aviso passarem nos testes.

## 6. Progresso, troféu e economia

Adicionar save da campanha em chave separada, por exemplo `acrobatic_train_campaign_v1`, com `schemaVersion`, `contentVersion`, `highestUnlockedLevel`, resultados por fase e conquistas. IDs estáveis: `level-01` até `level-09`; troféu `campaign-9-complete`.

Resultados guardam melhor pontuação local, tempo de simulação e conclusão. Validar tipos/faixas ao carregar, migrar versões suportadas e recuperar um estado inicial se o JSON estiver inválido. Se o armazenamento falhar, permitir jogar e avisar que o progresso desta sessão não será persistido.

Conceder o troféu uma vez, após registrar a conclusão das nove fases oficiais. Mostrar uma celebração curta, nome do troféu e galeria simples. Repetir a fase 9 não duplica a conquista. Conclusões com mods ficam em histórico separado e não contam para o troféu oficial.

### Contrato proposto com a Train Shop

O outro agente continua responsável pelo catálogo, preços, compra, equipamento, saldo e modelos. Os preços solicitados permanecem como requisito da loja: 50, 100, 1.000 e 2.000 pontos. Este planejamento não altera essas decisões nem os arquivos em edição.

| Informação / operação | Autoridade proposta | Consumidor |
| --- | --- | --- |
| `trainId`, propriedade, equipamento e quantidade de carros | Train Shop | Inicialização da tentativa e renderização |
| `getTrainGameplayProfile(trainId)` | Contrato da loja integrado ao gameplay | Velocidade/atributos numéricos, com unidades explícitas |
| `awardPoints({ eventId, runId, amount, source })` | Economia compartilhada, com um único escritor | Coleta, manobra e eventual recompensa de campanha |
| `levelCompleted` e `campaignCompleted` | Campanha | Progresso, resultados e conquista |
| `trainEquipped` | Loja | Preparação da próxima tentativa; não reconfigura a física em andamento |

Os nomes acima são interfaces propostas, não APIs existentes. Até integrar a loja, não criar um segundo saldo ou um segundo catálogo. Preservar as chaves atuais `acrobatic_train_best`, `acrobatic_train_bank_points`, `acrobatic_train_unlocked_trains` e `acrobatic_train_current_train`; uma eventual migração só ocorre com contrato explícito e testes.

Na primeira entrega da campanha, manter os ganhos atuais e não adicionar bônus de conclusão. Primeiro medir os ganhos por tentativa e o tempo para alcançar cada compra. Os quatro preços somam 3.150 pontos se o jogador comprar todos os trens; o saldo inicial de 50 pontos é uma decisão já presente no código da loja, a confirmar na integração. Se necessário, propor depois uma recompensa de primeira conclusão, aplicada uma vez pelo escritor da economia.

Para a campanha oficial, limites de velocidade são controlados pela fase; diferenças entre trens só entram se todas as fases forem validadas com elas. Para partidas competitivas, igualar os atributos físicos ou separar categorias: o multiplicador x1.5 do Class 395 não pode determinar vantagem no resultado da disputa.

O Jev atual pode continuar como comentário de estilo no modo casual. Progresso, conquista e resultado competitivo usam regras locais/da simulação. Definir separadamente a pontuação casual com bônus de IA e a pontuação determinística usada em comparações. Não exigir disponibilidade da API para completar uma fase.

## 7. Organização técnica proposta

Extrair responsabilidades por necessidade, mantendo ES modules, JavaScript/CSS simples e sem migração obrigatória de stack.

| Local proposto | Responsabilidade |
| --- | --- |
| `src/core/game.js` | Inicialização e coordenação dos módulos |
| `src/core/game-state.js` | Transições da tentativa, motivos de pausa e identidade `runId` |
| `src/core/events.js` | Eventos de domínio e snapshots do estado |
| `src/core/rng.js` | RNG com seed para conteúdo; RNG visual independente |
| `src/core/progress-store.js` | Save versionado exclusivamente da campanha |
| `src/levels/campaign.js` | Seleção, desbloqueio, chegada e conclusão |
| `src/levels/level-config.js` | Nove configurações e seus encontros |
| `src/entities/track.js` | Percurso e retenção dos segmentos |
| `src/entities/obstacles.js` | Modelos, avisos e ciclo de vida dos obstáculos |
| `src/physics/train-motion.js` | Movimento, saltos e estado dos truques |
| `src/physics/collisions.js` | Colisões e coleta, incluindo altura e movimento contínuo |
| `src/scene/world.js` | Cena, luzes, câmera e recursos compartilhados |
| `src/audio/sound.js` | Áudio atual e novos sinais; migrar importações em etapa própria |
| `src/ui/campaign-ui.js` | Seleção/briefing/resultado/troféu e foco dos modais |
| `src/ui/hud.js` | HUD por snapshot, com updates limitados |

Adicionar `src/levels/` como extensão de responsabilidade clara ao mapa do AGENTS.md. O módulo de campanha não precisa conhecer Three.js nem tocar no DOM. Configurações de conteúdo são dados; a física não controla telas.

Adotar passo fixo de simulação antes dos testes reproduzíveis e da rede. Limitar passos acumulados após suspensão da aba e interpolar a renderização. Em campanha/competição, slow motion deve ter política uniforme: preferir efeito visual sem mudar o relógio das janelas de obstáculos. Pausa local congela tempo, perigos e progresso; rede usa regras próprias.

Geometrias/materiais compartilhados têm dono e descarte no encerramento do sistema; recursos exclusivos do nível têm descarte na transição. Remover objetos da cena não substitui `dispose`. Cancelar timers/listeners de módulos desmontados e invalidar respostas anteriores. Medir estabilidade de recursos em reinícios repetidos.

## 8. Multiplayer

Hipótese inicial enquanto a preferência específica não é respondida: dois jogadores online, cada um controlando seu trem. Multiplayer local e cooperação dividindo os truques são alternativas futuras; não somar esses três escopos no primeiro marco.

Proposta inicial: sala privada por código, dois jogadores, mesma fase/seed, contagem regressiva e corrida sem colisão entre jogadores. O primeiro a chegar vence; se ambos caírem, vence quem percorreu mais distância, com pontuação determinística como desempate. Empate total permanece empate. Jogador que cai deixa de controlar sua tentativa e pode assistir o outro.

### Base necessária

- Servidor de salas e simulação, separado do servidor estático; transporte WebSocket escolhido e pesquisado na implementação.
- Servidor define `roomId`, participantes, fase, seed, versão de conteúdo, perfil físico uniforme e tick de início.
- Clientes enviam comandos sequenciados; servidor valida entradas, simula movimento/colisão e declara resultado. Exibir posição do adversário com interpolação e corrigir divergência local.
- Definir limites de frequência/tamanho das mensagens e prazo de sala. Não confiar em pontuação, desbloqueio ou chegada enviados como fato pelo cliente.
- Atalhos de pausa/loja não congelam nem alteram uma corrida online. Equipamento é fixado antes da largada; abrir sobreposição não bloqueia a simulação dos demais.
- Primeiro MVP: desconexão após largada resulta em abandono depois de uma tolerância configurada; se ambos saírem, encerrar sem vencedor. Reconexão e retomada completa ficam para outro marco.
- Histórico local não comprova propriedade/recorde online. Inicialmente oferecer os mesmos atributos e opções visuais permitidas aos dois participantes, sem transferir saldo local como moeda validada no servidor.
- Chaves externas continuam no ambiente do backend; campanha e rede não precisam chamar IA por frame.

Critérios de aceite: partida real com dois clientes, mesma versão/layout, resultado consistente, adversário visível, tratamento de entradas duplicadas e desordenadas, latência/jitter simulados, abandono e expiração da sala. Ghost/replay é um ensaio útil para a simulação, mas não conta como multiplayer entregue.

## 9. Mods e expansão gradual

Primeira versão de mods: pacotes JSON declarativos para fases personalizadas, distribuição de obstáculos, parâmetros limitados e temas de paleta. Não executar JavaScript importado, não usar `eval` nem permitir que um pacote injete HTML ou defina endpoints.

Manifesto proposto: `id`, `name`, `version`, `schemaVersion`, `compatibleGameVersion`, `author`, `description`, `levels` e tema. Usar IDs com namespace e registro das famílias de obstáculos já implementadas; famílias inéditas exigem versão do motor, não código embutido no pacote.

- Validar formato, tipos, intervalos, tamanho total, quantidade de entidades, seeds e IDs antes de carregar.
- Não permitir caminhos/URLs arbitrários para assets na primeira versão; usar recursos já registrados no jogo.
- Validar rotas e avisos de obstáculos com as mesmas regras da campanha. Recusar configurações excedentes e mostrar mensagem clara.
- Disponibilizar primeiro alguns pacotes de exemplo, depois ampliar o catálogo conforme os testes e feedback.
- Separar progresso de mods da campanha oficial. Inicialmente, mods também não rendem saldo para a loja; isso evita que um arquivo arbitrário gere moeda sem limite.
- Multiplayer oficial utiliza somente conteúdo conhecido pelo servidor, com versão/hash compatíveis entre participantes. Mods online privados são um marco posterior.

Aceite: importar pacote válido, jogar/reiniciar/desativar, manter save oficial, rejeitar JSON inválido ou excessivo e IDs desconhecidos; restaurar conteúdo padrão sem recarregar toda a aplicação. O catálogo cresce sem alteração do núcleo para cada fase adicional.

## 10. Ordem de implementação e entregas

| Marco | Entrega verificável | Dependências |
| --- | --- | --- |
| M0 — Integrar a loja | Inventário final da Train Shop, contrato de saldo/equipamento/atributos, regressão de controles e pausa | Entrega do outro agente |
| M1 — Base da campanha | Estado modular, `runId`, relógio/RNG reproduzíveis, fase 1 finita, resultado e retry | M0 para integrações; configurações puras podem ser preparadas antes |
| M2 — Fases fáceis | Fases 1–3, save/desbloqueio, HUD de distância/fase, barreira fixa, coleta aérea corrigida | M1 |
| M3 — Fases médias | Fases 4–6, cancelas, abertura de alinhamento e vagão móvel, avisos/colisões testados | M2 |
| M4 — Campanha completa | Fases 7–9, troféu, galeria, continuar campanha e modo infinito separado | M3 |
| M5 — Multiplayer | Dois clientes online, salas e resultado autoritativo | M4 e simulação compartilhável; backend novo |
| M6 — Plataforma de mods | Manifesto, validador, seleção e pacotes iniciais | M4 e registro de conteúdo estável; pode ocorrer em paralelo a M5 com responsáveis distintos |

M1–M4 formam a primeira versão recomendada. M5 e M6 são entregas separadas. Não estimar prazo fechado antes de estabilizar a entrega da loja e validar uma fase representativa.

### Backlog inicial executável

1. Confirmar o estado final da loja e congelar os contratos compartilhados; nenhuma edição concorrente de `game.js`, `hud.js`, HTML/CSS ou fábrica de trens.
2. Extrair estado da tentativa e resolver os motivos de pausa; aplicar identidade de tentativa aos bônus/timeouts.
3. Introduzir configuração de fase e RNG do percurso; criar simulação testável sem DOM.
4. Implementar chegada e resultado na fase 1, com regra de colisão antes da vitória.
5. Persistir desbloqueios e permitir repetir/continuar; integrar HUD e resultados aos pontos de extensão da loja.
6. Corrigir coleta por altura e recursos/retenção necessários para a campanha, dividindo propriedade dos arquivos com o responsável pela loja.
7. Entregar 2–3 com encontros reproduzíveis e caminhos de referência.
8. Entregar cada nova família de obstáculos com colisão/aviso antes de compor 4–6.
9. Balancear 7–9 e validar todas com o trem gratuito; conceder troféu e preservar modo infinito.
10. Só então abrir os marcos de rede e pacotes de conteúdo.

## 11. Validação e definição de pronto

### Testes futuros necessários

| Área | Casos essenciais |
| --- | --- |
| Estados | Start, pausa manual, loja durante pausa, derrota, retry, resultado, avanço e retorno ao menu |
| Progresso | Fase 2 bloqueada antes da 1; reload preserva desbloqueio; JSON inválido/versão anterior/storage indisponível |
| Conclusão | Chegada viva, colisão no passo da chegada, fase já concluída, fase 9 e troféu concedido uma vez |
| Pontos/loja | Saldo com único escritor, replay de evento sem duplicação, compras preservadas, equipamento fixo por tentativa |
| Assíncrono | Resposta da IA após crash/retry/avanço/menu não altera saldo/resultado; timer antigo não encerra a nova tentativa |
| Física | Coleta aérea exige altura, obstáculo móvel sem tunneling, gap com salto/pouso válidos e truques em vias distintas |
| Conteúdo | Mesmo seed/layout; trajetos de referência nas nove fases; fronteiras de segmento/encontro e todos os perfis de trem |
| Recursos | Reinícios/transições repetidos sem crescimento contínuo de geometrias, texturas, materiais ou listeners |
| Interface | Teclado e touch; foco em modais, retorno do foco, botão/atalho sem ativar gameplay atrás de tela; retrato e paisagem |
| Multiplayer/mods | Casos definidos nas seções 8 e 9, antes de declarar esses marcos entregues |

Criar testes determinísticos dos módulos de estado/progresso/conteúdo e testes de navegador com asserções reais para o fluxo completo. Usar `tests/` para alinhar com a ferramenta de cobertura do projeto. Scripts atuais de captura podem apoiar a evidência visual, mas não substituem asserções nem playtest.

Meta de fluidez: 60 FPS no ambiente desktop de referência e controles responsivos no dispositivo móvel escolhido. Registrar aparelho, navegador, configurações e métricas. Não declarar desempenho pela leitura do código.

### O que foi verificado nesta tarefa

- Lidos a transcrição, README, AGENTS.md, manifests, HTML/CSS, módulos de gameplay/HUD/input/áudio/modelos e scripts relevantes de servidor, captura/teste e Jev.
- Não foi encontrada pasta `tests/` no inventário. `scripts/test-pause.js`, `test-cab-console.js` e `test-train-details.js` dependem de navegador/CDP local e capturam/logam resultados; não comprovam as features novas.
- `node --check src/core/game.js`: passou. É uma checagem sintática, sem prova de comportamento no navegador.
- GameForge `doctor`: executado; Node e Chromium de teste disponíveis. Não foi feito playtest nem renderização do jogo.
- Guardrail Jev: primeira tentativa falhou no acesso à rede; segunda tentativa respondeu e aprovou a proposta de alteração somente deste documento (`none`, severidade 0,02). Isso não valida a implementação futura.
- Nenhuma execução da suíte Jev de demonstração ou dos scripts de navegador foi utilizada como prova de gameplay.

## 12. Decisões fechadas e pendentes

**Fechadas nesta conversa:** basear features na transcrição; Train Shop sob responsabilidade do outro agente; mods como suporte extensível e catálogo gradual; entrega atual é o plano.

**Propostas adotadas no plano, ainda ajustáveis:** chegada por distância sem meta obrigatória de pontos, fase 9 solucionável, colisão inicial apenas da locomotiva, atributos controlados por fase, sem bônus extra de conclusão no primeiro ciclo e mods separados da economia/conquista oficial.

**Pendente de preferência:** formato prioritário de multiplayer. Dois jogadores online com trens separados é a hipótese inicial, registrada como tal.

**A confirmar na integração:** contrato final da loja, política de equipamento durante uma tentativa, unidades/efeitos dos atributos e economia. **A calibrar em playtest:** comprimentos, velocidades, avisos, espaçamento e dificuldade humana da fase final.
