-- Correcoes da revisao de seguranca de professor/coordenador (07/10/2026).
-- Nada de V1..V9 foi editado: as duas mudancas abaixo sao aditivas.

-- 1) A contestacao do lider sobrevive a remocao do docente.
--
-- Ela morava so em membro.docente_contestado_*, e removerMembro apaga a linha de
-- membro: o lider contestava, removia, o docente voltava pelo codigo de convite e o
-- vinculo novo nascia limpo — contestacao desfeita sem ninguem restaurar nada.
-- Esta tabela e a memoria duravel: a chave e (turma, usuario), nao o vinculo, e o
-- vinculo novo herda dela ao nascer. membro.docente_contestado_* continua sendo o
-- que o PoderNaTurma le; aqui so se guarda o que nao pode morrer com a linha.
--
-- ON DELETE CASCADE na turma e no usuario: se a turma ou a conta deixam de existir
-- nao ha mais a quem contestar. contestado_por e FK simples, como em membro.
CREATE TABLE contestacao_docente (
  turma_id        UUID        NOT NULL REFERENCES turma(id)   ON DELETE CASCADE,
  usuario_id      UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contestado_em   TIMESTAMPTZ NOT NULL,
  contestado_por  UUID        NOT NULL REFERENCES usuario(id),
  PRIMARY KEY (turma_id, usuario_id)
);

-- Contestacoes que ja estavam gravadas no vinculo entram na tabela nova, senao
-- remover um docente ja contestado ainda apagaria o unico registro dela.
INSERT INTO contestacao_docente (turma_id, usuario_id, contestado_em, contestado_por)
SELECT turma_id, usuario_id, docente_contestado_em, docente_contestado_por
FROM membro
WHERE docente_contestado_em IS NOT NULL
  AND docente_contestado_por IS NOT NULL;

-- 2) Quem criou a turma. Sem isto nao ha como contar "turmas criadas" por conta
-- docente PENDENTE (o teto de criacao); vinculo nao serve, porque entrar por codigo
-- tambem gera vinculo docente. NULL = turma anterior a esta coluna, ou criada por
-- aluno antes do teto (nao entra na conta, e o teto e so de docente).
ALTER TABLE turma ADD COLUMN criada_por UUID NULL REFERENCES usuario(id);
