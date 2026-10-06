# M6 — Pacotes de conteúdo e catálogo gradual

Status: planejado. Dependência: [M4](m4-campanha-completa.md) e registro de obstáculos de M3. Pode ser implementado independentemente de [M5](m5-multiplayer.md), com arquivos/responsáveis distintos.

## Objetivo e escopo

Permitir instalar, selecionar, jogar e remover pacotes JSON de fases/temas usando as famílias de obstáculos existentes. “365 mods” foi interpretado pelo usuário como suporte a mods e crescimento gradual. MVP propõe três pacotes de exemplo: desvios, saltos e precisão; não promete uma quantidade anual ou diária.

Não importar código, HTML, shaders, endpoints, caminhos de disco ou URLs arbitrárias. Não permitir famílias físicas desconhecidas. Conteúdo personalizado usa save próprio, sem moedas da loja ou troféu oficial.

## Tarefas na ordem de execução

1. Definir schema versionado do manifesto: IDs com namespace, nome/descrição, versão, compatibilidade, autor, tema e fases. Parser cria objetos por allowlist; recusa chaves como `__proto__`, `constructor` e `prototype` em campos estruturais.
2. Aplicar orçamentos iniciais: arquivo ≤ 1 MiB, até 20 fases/pacote, até 100 encontros/fase, até 500 entidades ativas e 3 pacotes instalados no MVP. Texto de nome até 80 caracteres e descrição até 1.000. Tudo configurável e testado.
3. Restringir física inicial a velocidade 8–42 m/s, comprimento 300–3.000 m e parâmetros compatíveis com os budgets/validador. Não aceitar `NaN`, infinitos, números negativos ou seeds de tipo inesperado.
4. Reutilizar validação de configuração, avisos e conexões de rota. Recusar pacotes sem caminho validado pelo algoritmo; deixar explícito que isso não garante qualidade humana.
5. Criar registro de conteúdo ativo separado do oficial e storage versionado, por exemplo `acrobatic_train_mods_v1`. Guardar pacote/cópia validada apenas após validação completa.
6. Importação transacional: validar nova versão em área temporária; substituir registro somente no sucesso. Pacote inválido não desmonta a fase atual nem altera save.
7. UI de catálogo/importação/ativação/desativação/remoção com nomes renderizados como texto. Remover pacote ativo encerra tentativa customizada com aviso e retorna ao padrão, sem reiniciar toda a aplicação.
8. Criar três pacotes de exemplo e fixtures inválidas/adversariais. Desativação libera recursos e restaura catálogo/tema padrão.
9. Rerodar campanha/loja depois de ciclos de ativação; documentar como criar pacote, limites e compatibilidade. Futuro catálogo remoto/mods de rede exigem marco próprio.

## Entregáveis propostos

`src/mods/manifest.js`, `validator.js`, `registry.js`, `store.js`; UI de mods; schema e três pacotes de exemplo; `tests/mods.test.js`; guia de autoria. Não adicionar um interpretador de JavaScript nem tratar arquivo de usuário como configuração irrestrita.

## Aceites

| ID | Resultado exigido |
| --- | --- |
| M6-A01 | Pacote válido importa e cria fases/tema sem modificar o núcleo |
| M6-A02 | Formato incompatível, números inválidos, IDs/famílias desconhecidas e excesso de orçamento recusados |
| M6-A03 | Nenhum pacote executa código, injeta HTML, altera protótipo ou acessa asset/URL não registrada |
| M6-A04 | Importação/atualização inválida mantém pacote anterior e tentativa/save intactos |
| M6-A05 | Mods não concedem saldo, desbloqueio ou troféu oficial; progresso customizado separado |
| M6-A06 | Ativar/reiniciar/desativar/remover restaura padrão e libera recursos |
| M6-A07 | Três exemplos passam validação/rotas; autoria/compatibilidade/erros documentados |

## Casos de teste

| ID / tipo | Precondição → ação | Asserções esperadas | Aceite |
| --- | --- | --- | --- |
| M6-T01 / integração | Manifesto válido com dois layouts e tema permitido → importar/jogar | IDs namespaced registrados, seed/layout corretos, sem edição de arquivo do motor | M6-A01 |
| M6-T02 / parametrizado | Fixtures fora dos limites, incompatíveis, sem rota ou com família inexistente → validar | Erro no campo correto, registro/storage sem novo pacote; memória do parser limitada | M6-A02 |
| M6-T03 / segurança de comportamento | Campos com script/HTML, chaves de protótipo e URL/path → importar/renderizar | Estruturais recusados; texto não executa; zero requisições de asset arbitrário; protótipos inalterados | M6-A03 |
| M6-T04 / transação | Versão válida ativa → importar substituição inválida ou storage lança | Versão anterior permanece; save/tema/tentativa intactos; erro compreensível sem sucesso falso | M6-A04 |
| M6-T05 / integração | Save oficial conhecido → coletar milhares de itens/concluir mod | Saldo e troféu oficiais idênticos; resultado apenas em escopo customizado | M6-A05 |
| M6-T06 / E2E e recursos | 30 ciclos de ativação/retry/desativação/remoção → iniciar fase oficial | Padrão restaurado, listeners/recursos estáveis, seleção de conteúdo removido recusada | M6-A06 |
| M6-T07 / conteúdo e documentação | Três exemplos → validar/rodar rotas; seguir guia com pacote novo | Exemplos passam; novo pacote usa só recursos documentados; incompatibilidade produz mensagem clara | M6-A07 |

## Gate de saída

Importação, isolamento, recuperação e remoção passando com pacotes válidos e adversariais; catálogo oficial/loja sem regressão. Mod inválido não pode entrar porque “parece simples”. Crescimento futuro adiciona dados e evidencia playtest; novos comportamentos físicos requerem uma versão do motor.
