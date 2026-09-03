-- A turma é o grupo de pessoas, não o semestre em que ele está.
--
-- MOTIVO
-- `semestre` era NOT NULL e escrito uma vez, na criação. No sexto período a
-- turma se chamava "Fans 2026.2"; no sétimo ela continua se chamando isso, e
-- ninguém tem como corrigir. Um dado que envelhece sozinho e não pode ser
-- atualizado é pior que dado ausente: ele parece atual.
--
-- DUAS MUDANÇAS, E ELAS SÃO DIFERENTES
--
-- 1. `semestre` passa a ser opcional. Quem cria a turma nem sempre sabe — e
--    obrigar faz inventar. Turma sem semestre é uma turma; turma com semestre
--    errado é uma mentira.
--
-- 2. `atualizado_em` entra para que a edição exista de verdade. Sem ele não há
--    como saber se o "2026.2" na tela foi conferido este ano ou herdado de dois
--    períodos atrás.
--
-- O que NÃO muda: o código de convite. Ele identifica a turma e é o que está
-- anotado nos celulares de todo mundo — trocá-lo junto com o semestre expulsaria
-- a turma inteira do próprio grupo.

ALTER TABLE turma
  ALTER COLUMN semestre DROP NOT NULL;

ALTER TABLE turma
  ADD COLUMN atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN turma.semestre IS
  'Periodo atual da turma, editavel. NULL = ninguem informou. NAO faz parte da '
  'identidade: a turma e identificada pelo id e pelo codigo de convite, que nao '
  'mudam quando o semestre vira.';

COMMENT ON COLUMN turma.nome IS
  'Como a turma se chama. Parte estavel da identidade — sobrevive a virada de '
  'periodo.';
