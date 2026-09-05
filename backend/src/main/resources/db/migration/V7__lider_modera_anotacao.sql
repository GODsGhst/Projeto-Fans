-- O líder passa a moderar anotação, como já modera evento e material.
--
-- POR QUE ESTAVA DE FORA, E POR QUE ENTRA AGORA
-- A V5 registrou a ausência como lacuna conhecida, não como esquecimento. Mas
-- ela é a única brecha no contrato social do app: toda tela diz que "o líder só
-- oculta o que não devia estar ali", e uma anotação de alcance TURMA é
-- justamente o conteúdo mais fácil de publicar sem pensar — vai para os trinta,
-- assinada, num toque.
--
-- MESMA MECÂNICA DAS OUTRAS, DE PROPÓSITO
-- Ocultar não apaga: o registro continua no banco, com autoria, e volta em "não
-- listados" para quem escreveu. Quem apaga é sempre quem criou.
--
-- A NOTA PESSOAL NÃO É AFETADA, e isso não é detalhe.
-- O líder não vê rascunho de ninguém — a query nunca devolveu nota PESSOAL de
-- outra pessoa, e continua não devolvendo. Ele só pode ocultar o que ele já
-- consegue ler, que é o recado da turma. Um líder capaz de ocultar um rascunho
-- que ele não pode ler seria poder sobre o invisível.

ALTER TABLE nota
  ADD COLUMN visivel_turma BOOLEAN NOT NULL DEFAULT true;

-- O índice parcial da V5 cobria (turma, dia) para as vivas. A leitura agora
-- também filtra por visibilidade, então ele é refeito incluindo a coluna —
-- senão a query volta a varrer a tabela conforme os rascunhos se acumulam.
DROP INDEX IF EXISTS nota_por_turma_e_dia;
CREATE INDEX nota_por_turma_e_dia ON nota (turma_id, data_nota, visivel_turma)
  WHERE excluido_em IS NULL;

COMMENT ON COLUMN nota.visivel_turma IS
  'false = o lider ocultou da lista da turma. O autor continua vendo em "nao '
  'listados". So se aplica a nota de alcance TURMA: a PESSOAL nunca sai para '
  'outra pessoa, entao nao ha o que ocultar.';
