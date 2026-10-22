# Pendências do port Flutter

Cada área registra aqui o que precisou da fundação e não encontrou, ou a armadilha do spec que não conseguiu tratar — com o motivo.

## Integração (núcleo, rotas, boot)

**Correção na fundação (`notifications/notificacoes.dart`).** `NotificacoesService` passou a declarar `implements LembretesSync`, sem o que o `SyncRepository` não recebia o serviço. Os três membros ganharam `@override`. Nada mais mudou.

**Nomes de campo em `Servicos`.** `api`, `auth`, `armazenamento`, `turmaAtiva`, `abas`, `notificacoes`, `chaveIa`, `sync`, `home`, `eventos` (EventoRepository), `materias` (MateriaRepository), `materiais` (MaterialRepository), `notas`, `moderacao`, `turma`, `quadro`, `painel`, `docenteAdmin`, `navegacao` (PonteNavegacao). Área que usar outro nome fala com a integração.

**Rotas num lugar só.** A tabela fixa vive em `core/rotas.dart`, em `criarRoteador`. Não há `features/<area>/rotas_<area>.dart`: o contrato pede que a área troque só o corpo do esqueleto e mantenha a assinatura do construtor.

**Títulos dinâmicos nos esqueletos.** Os esqueletos usam o texto estático que o Angular mostra quando não há dado (`Home`, `Matéria`, `Evento`, `A turma`). A área substitui pelo título real.

**Casca das abas só com barra inferior.** A `NavigationBar` está pronta. O menu lateral do PC (largura ≥ 768 px, com o botão de recolher, armadilhas 52–55) não foi portado.

**Troca de turma reinicia o estado.** `Servicos.reiniciarEstado()` zera os notifiers de turma e chama `TurmaRepository.limpar()`. Requisição em voo da turma antiga ainda pode repovoar o estado depois da troca. O reload do Ionic matava isso; aqui não mata. Revisar quando o painel do docente for portado.

**SEM_TURMA também apaga a turma ativa do docente.** É a divergência recomendada pela armadilha 21: `onSemTurma` chama `conciliar([])`, que limpa memória e disco. Sem isso, X-Turma-Id seguiria apontando para a turma da qual ele foi removido.

**Falha de plataforma ao ler a sessão no boot.** `main` registra no log e segue sem sessão, então o app abre na entrada. A armadilha 41 pede também uma mensagem visível; não há tela de mensagem de boot. Pendente.

**Dúvida aberta com o dono (armadilha 7 do núcleo).** O spec aponta conflito entre "não há suporte a múltiplas turmas" e o `TurmaAtivaService.escolher()` do painel docente. A fundação implementa `escolher` e `conciliar` como o Ionic faz. Decidir antes de a tela do painel ganhar seletor.

**Redirecionamento só na navegação (armadilha 63).** A guarda de aba reage a login e turma, não à troca de tipo de conta. Trocar aluno por docente com a tela aberta não redireciona. Implementado em `_MudancaDeSessao`.

