-- O resumo é da TURMA, não de quem pediu.
--
-- MOTIVO
-- Gerar o resumo custa dinheiro, e quem paga é o dono da chave que foi colada
-- no aparelho. Se o resumo vivesse só no celular de quem pediu, cada um dos
-- trinta teria de pagar de novo pelo mesmo PDF. Guardado aqui, uma pessoa
-- gera e a turma inteira lê — que é o app inteiro em uma frase.
--
-- `resumo_por` registra quem pagou a chamada. NÃO vai para a tela: a
-- procedência que importa ao leitor é "isto foi escrito por uma IA, nesta
-- data" — quem clicou no botão não muda como o texto deve ser lido. A coluna
-- fica porque, quando o recurso virar pago, é ela que responde quem gastou.
--
-- `resumo_em` não é enfeite: modelo muda, PDF é trocado no mesmo link, e um
-- resumo de três meses atrás precisa poder ser reconhecido como velho.
--
-- A CHAVE DA API NÃO ESTÁ AQUI, e a ausência é a decisão. Ela chega no header
-- da requisição, é usada e descartada. Guardá-la no banco transformaria este
-- servidor num alvo que hoje ele não é: hoje o pior vazamento é o conteúdo da
-- turma; com chaves guardadas, seria a conta de terceiros de cada aluno.

ALTER TABLE material
  ADD COLUMN resumo TEXT,
  ADD COLUMN resumo_em TIMESTAMPTZ,
  ADD COLUMN resumo_por UUID REFERENCES usuario (id);

COMMENT ON COLUMN material.resumo IS
  'Resumo gerado por IA a partir do arquivo em `url`. NULL = ninguem gerou '
  'ainda. Compartilhado com a turma inteira de proposito.';
