# M4 — Campanha completa: implementação e validação automatizada

Data: 07/10/2026. **M4 implementada, com validação automatizada aprovada. Playtest humano (M4-A07) e orçamento de frame time em hardware (parte de M4-A06) pendentes.**

## Comportamento entregue

- **Fase 7, *Sequência acrobática*** (1300 m, 26→36 m/s): seis encontros combinados. São eles: rampa + trilho rompido no centro, cancela à direita + postes, trilho rompido + pórtico aberto à esquerda, vagão + trilho rompido no centro, rampa + trilho rompido à direita, e cancela à esquerda + pórtico central.
- **Fase 8, *Corredor de precisão*** (1400 m, 28→39 m/s): cancela central, pórtico à direita, vagão vindo da direita (duas trocas até a esquerda), rampa à esquerda + trilho rompido no centro, cancela + postes, pórticos sucessivos (direita e depois centro) e o último reparo, com esquerda e centro rompidos.
- **Fase 9, *Desafio final*** (1500 m, 30→42 m/s): onze encontros autorados, sempre na mesma sequência e sem sorteio. Inclui R→L com duas trocas antes do pórtico lateral, duas rampas opcionais e dois vagões, e termina no pórtico central.
- **Limite de famílias**: nenhuma família nova nas fases 7–9, e cada encontro (isolado ou combinado por `group`) tem no máximo duas famílias perigosas. O validador recusa uma terceira com `Too many hazard families in one encounter`.
- **Troféu `campaign-9-complete`**: vem de nove conclusões oficiais válidas. É concedido uma única vez e persiste depois de reload. Uma flag gravada sem as nove conclusões não concede nada. Nove conclusões válidas sem a flag restauram o troféu. Fontes `mod`, `online` e `infinite` não escrevem progresso oficial.
- **Tela "CAMPANHA COMPLETA!"**: mostra o troféu e oferece **jogar modo infinito** (com foco inicial), **repetir** e **escolher fase**. A fanfarra respeita o mudo, e a animação do troféu respeita `prefers-reduced-motion`. Repetir a final mostra "troféu já conquistado" e não cria outro.
- **Galeria no mapa**: estado do troféu (ou contagem n/9) e, para cada fase concluída, melhor tempo, melhor pontuação e número de conclusões.

## Decisões

1. **Encontros combinados** usam o mecanismo `group` da M3. As partes de um grupo compartilham a via segura e dispensam o descanso entre si. A mensagem do primeiro elemento anuncia as duas famílias, e o orçamento de aviso é checado nessa primeira mensagem.
2. **Pórticos sucessivos da fase 8**: o envelope do plano (1060–1110 m) não comporta a troca R→C com o aviso do grupo difícil. Por isso, os dois pórticos ficam em 1070 m e 1150 m, com aviso efetivo de 1,78 s (mínimo exigido: 1,60 s), como o próprio plano autoriza ("alongar espaço se o budget falhar").
3. **Rampas**: o salto é sempre opcional. Na fase 7, ficar no centro sem input salta o primeiro trilho rompido (rota válida), e a derrota só vem no pórtico. Todos os pousos das rotas acrobáticas deixam o aviso completo antes da próxima troca de via (F07-T03).
4. **Cauda com trilhos**: `applyTrainModel` recalcula a retenção traseira pelo número de vagões antes de montar a pista. No Class 395 (12 carros), a cauda fica a 108,9 m atrás da locomotiva, e a pista da fase começa em −178,9 m (retenção de 168,9 m mais 10 m de margem).

## Aceites M4

| Aceite | Estado | Evidência |
| --- | --- | --- |
| M4-A01 | Aprovado automaticamente | Fixtures 7–9 válidas; avisos efetivos ≥ fórmula; limite de duas famílias; rotas terrestres, acrobáticas e de reação tardia; derrota sem input |
| M4-A02 | Aprovado automaticamente | Campanha 1→9 com cyber, score 0, sem compra nem API (Node), e no navegador partindo de save novo com reloads após as fases 3 e 6 |
| M4-A03 | Aprovado automaticamente | Sem troféu com 8; troféu único com 9; evento duplicado recusado; retry mantém um; persistente; flag forjada recusada |
| M4-A04 | Aprovado automaticamente | Foco inicial em "Jogar modo infinito", Tab preso no modal, nenhum oscilador com mudo, retry da 9 sem duplicação (desktop e touch) |
| M4-A05 | Aprovado automaticamente | Infinito passa de 1500 m sem conclusão; botão infinito após a final não altera progresso; fontes não oficiais recusadas |
| M4-A06 | Recursos aprovados; **frame time em hardware pendente** | Class 395 e steam nas fases 7–9: cauda com trilhos, recursos estáveis em ciclos repetidos, fase 9 concluída. FPS medido só em SwiftShader |
| M4-A07 | **Pendente de playtest humano** | Requer registro de derrotas e tentativa seguinte nas fases 7–9 |

## Execuções

`npm test`: **62 testes passaram**, zero falhas. Nove são novos, em `tests/m4-campaign.test.js`. O helper de reação tardia foi extraído para `tests/helpers/late-route.js`.

E2E do navegador: ver a seção abaixo, preenchida com a execução final.

## Reprodução

```powershell
npm test
$env:PLAYWRIGHT_MODULE_DIR = '<diretorio-do-runtime>/node_modules'
npm run test:browser:m4   # TEST_SCOPE=campaign | touch | long-train
npm run test:browser:m3
npm run test:browser
```

Para fechar o marco, falta:

- jogar as fases 7–9 em teclado e touch, registrando a causa de cada derrota e se o jogador consegue planejar a correção;
- medir frame time em hardware real (desktop: 95% abaixo de 20 ms; mobile: 95% abaixo de 33,3 ms), com o Class 395 e o steam na fase 9;
- rerodar rotas e fixtures depois de qualquer ajuste.
