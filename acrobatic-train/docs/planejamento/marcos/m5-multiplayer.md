# M5 — Multiplayer online para dois jogadores

Status: implementado em 07/10/2026; validação automatizada aprovada com dois navegadores reais. Pendentes: rede real/móvel, latência visual em hardware e playtest. [Relatório por aceite](../VALIDACAO_M5.md). Dependência: [M4](m4-campanha-completa.md) e simulação testável de M1. **Formato confirmado pelo usuário em 07/10/2026: online para dois jogadores, transporte WebSocket com o pacote `ws`.**

## Objetivo e regras iniciais

Sala privada por código, dois participantes, mesma fase/seed/versão, atributos físicos normalizados e sem colisão entre jogadores. Servidor controla a simulação e o resultado. O primeiro tick de chegada viva vence; se ambos chegam no mesmo tick, comparar fração de cruzamento no tick, se disponível, e declarar empate se indistinguível. Se ambos caem, comparar distância longitudinal no tick da derrota e score determinístico como segundo critério; persistindo igualdade, empate.

Quem caiu pode assistir. Se um abandona depois da largada, o participante ativo vence por abandono; se ambos abandonam antes da resolução, encerrar sem vencedor. Tolerância proposta de desconexão: 5 s do relógio do servidor. Sala sem largada expira após 5 min de inatividade; sala de resultado após 2 min. Valores são limites iniciais configuráveis, não funcionalidades existentes.

No MVP, nenhum resultado online altera saldo/troféu da campanha local. Visual e atributos permitidos vêm da sala; não validar propriedade por `localStorage`. Loja/pausa local não congelam sala; perfil físico não muda durante a partida.

## Tarefas na ordem de execução

1. Confirmar o formato antes de iniciar rede. Pesquisar transporte/biblioteca e compatibilidade do ambiente na implementação; registrar decisão e testes. Não escolher dependência só pelo nome.
2. Compartilhar a simulação pura com o servidor; definir tick de 60 Hz inicialmente e frequência de snapshots, proposta de 20 Hz, com medição de carga.
3. Criar servidor de salas separado dos arquivos estáticos; integrar somente rotas/upgrade necessários. Ajustar distribuição por proxy/TLS quando solicitado, sem publicar automaticamente.
4. Versionar protocolo: `join`, `ready`, `start`, `input`, `snapshot`, `result`, `leave`, `error`. Payload inclui versão, sala, participante e sequência. Seed/layout e perfis são definidos pelo servidor.
5. Validar pertencimento à sala, tipo/tamanho de mensagem, sequência e comando permitido. Identidade efêmera criada pelo servidor; cliente não escolhe ID de outro participante. Limites iniciais: mensagem de input ≤ 4 KiB e ≤ 120/s por participante; medir e ajustar.
6. Preparar lobby/código/ready e contagem regressiva única. Começar somente com dois participantes prontos e conteúdo compatível; recusar terceiro.
7. Cliente envia comandos, prevê o próprio movimento e reconcilia snapshots; interpola adversário. Resultado local preliminar não concede vitória.
8. Implementar derrota/espectador, resultado autoritativo, abandono/tolerância/expiração. Jogador terminal não envia movimentos aceitos; entradas duplicadas não aplicam duas vezes.
9. Escrever testes de protocolo/sala/simulação, dois browsers reais, latência/jitter e regressão solo; registrar limite de carga observado, sem prometer escala não medida.

## Entregáveis propostos

Módulos `src/network/`, servidor `scripts/server/rooms.js` e protocolo compartilhado; UI de sala/resultado; simulação reutilizável; `tests/multiplayer.test.js` e harness E2E de dois clientes. Credenciais externas só no ambiente do servidor; não há inferência de IA por tick.

### Contrato de mensagens a implementar

| Mensagem | Campos essenciais / validação | Quem decide |
| --- | --- | --- |
| `join` | Versão de protocolo, código da sala, nome limitado; servidor atribui identidade à conexão | Servidor aceita entrada/define participante |
| `ready` | Estado booleano; conexão pertence à sala e ainda está no lobby | Servidor verifica dois participantes e conteúdo compatível |
| `start` | `roomId`, `runId`, `startTick`, seed, hash/versão do conteúdo e perfil normalizado | Somente servidor emite |
| `input` | `runId`, sequência monotônica e comandos permitidos; janela de tick configurada | Servidor agenda aplicação no tick permitido; recusa inputs fora da janela |
| `snapshot` | Tick confirmado, poses/estados/score determinístico de ambos e última sequência aplicada | Somente servidor emite; cliente reconcilia com sua previsão |
| `result` | Identificador único, motivo, vencedor ou empate, ticks/distâncias/score confirmados | Somente servidor emite; resultado terminal não muda com mensagem tardia |
| `leave` | Conexão atual; não aceitar ID arbitrário de participante | Servidor registra abandono |
| `error` | Código estável e texto seguro, sem stack/credenciais | Emissor não altera estado de jogo como efeito colateral |

Definir a janela de ticks e o tratamento de atraso em teste de protocolo antes de habilitar previsão local. No MVP, servidor agenda comandos no próximo tick elegível; não há rollback do servidor nem confiança em posição calculada pelo cliente. Cliente mantém fila de comandos não confirmados para reconciliação. A entrada recebe identidade da conexão, não de um campo de usuário.

Budgets de apresentação iniciais: resposta visual ao input local em até 100 ms no p95; snapshots de 20 Hz com timestamp e limite de extrapolação de 250 ms; acima do limite, mostrar conexão instável e manter a autoridade do servidor. Medir número/magnitude das correções de posição em cada perfil de rede e definir o limite aceitável após o primeiro protótipo. M5-A04 não pode ser aprovado enquanto esse limite estiver indefinido.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M5-A01 | Dois clientes reais entram e largam juntos; terceiro/versão incompatível recusados |
| M5-A02 | Servidor define layout, perfil e vitória; cliente não pode forjar score/posição/conclusão |
| M5-A03 | Duplicados, reordenação, comando inválido e limite excessivo tratados sem corromper sala |
| M5-A04 | Adversário visível e jogável com latência/jitter do perfil de teste; resultado concorda nos dois clientes |
| M5-A05 | Derrota, empate, abandono, timeout e expiração têm um único resultado consistente |
| M5-A06 | Pausa/loja/equipamento local não alteram sala; save/saldo/troféu solo intactos |
| M5-A07 | Desconexão/encerramento liberam salas, timers e sockets; regressão solo passa |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M5-T01 / E2E | Dois browsers isolados e terceiro → join/ready; variante de versão diferente | Dois participantes, startTick único e seed/hash iguais; terceiro e incompatível recebem erro e não entram | M5-A01 |
| M5-T02 / protocolo | Cliente tenta enviar posição, score, resultado e ID de outro jogador | Payload rejeitado/ignorado conforme schema; servidor mantém simulação e identidade próprias | M5-A02 |
| M5-T03 / integração | Inputs com seq duplicada/antiga/futura fora da janela, JSON malformado e excesso de tamanho/frequência | Sem execução dupla; rejeição com código; limites protegem servidor; sala do adversário continua consistente | M5-A03 |
| M5-T04 / E2E com rede | Replays de dois clientes; RTT 50/150/300 ms e jitter até 50 ms → corrida | Nenhuma conclusão divergente; input local p95 ≤ 100 ms; extrapolação ≤ 250 ms; correções dentro do limite fixado no protótipo; perfil ruim exibe estado de conexão | M5-A04 |
| M5-T05 / unitário e integração | Chegadas iguais, quedas iguais, abandono único/duplo e sala ociosa → avançar relógio injetado | Desempate conforme regras, resultado emitido uma vez; dois abandonos sem vencedor; sala expira nos limites | M5-A05 |
| M5-T06 / E2E | Playing online com save solo conhecido → abrir loja, pausar, mudar seleção visual local | Tempo/atributos da sala constantes; nenhum troféu/saldo/desbloqueio solo concedido pelo resultado | M5-A06 |
| M5-T07 / recursos e regressão | Criar/encerrar 100 salas de teste e rodar campanha solo | Salas/sockets/timers retornam ao baseline; testes solo passam; registrar CPU/memória/carga, sem afirmar produção | M5-A07 |

## Gate de saída e limites

M5 só está pronto com dois clientes conectados de verdade. Ghost/replay não cumpre o aceite. Reconexão com retomada completa, ranking público, contas, matchmaking, mais de dois jogadores, cooperação e mods online privados ficam fora do MVP. Seleção de fase da sala não concede desbloqueio solo; definir visualmente esse escopo.
