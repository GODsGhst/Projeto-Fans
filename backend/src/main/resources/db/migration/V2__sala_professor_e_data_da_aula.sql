-- Onde a aula acontece, quem dá, e de que aula o material é.
--
-- MOTIVO
-- Três lacunas que apareceram no primeiro uso real do app:
--   1. a matéria não dizia a sala nem o professor;
--   2. a prova às vezes é em OUTRA sala (aconteceu: prova na sala do 2º período),
--      e não havia como registrar a exceção;
--   3. o material dizia só "de aula" ou "adicional", nunca de QUAL aula.
--
-- DESENHO: padrão na matéria, exceção no evento.
-- `materia.sala` é onde a matéria cai normalmente. `evento.sala` é NULL na
-- imensa maioria dos casos e significa "na sala de sempre"; preenchida, é a
-- exceção daquele dia. Repetir a sala em todo evento faria a mudança de sala da
-- disciplina exigir reescrever o passado — e o passado aconteceu na sala antiga.
--
-- TUDO OPCIONAL, e isso é deliberado. As matérias que já existem foram criadas
-- sem esses dados, e uma coluna NOT NULL exigiria inventar um valor para elas.
-- Sala inventada é pior que sala ausente: manda alguém para o lugar errado.

ALTER TABLE materia
  ADD COLUMN sala       TEXT NULL,
  ADD COLUMN professor  TEXT NULL;

COMMENT ON COLUMN materia.sala IS
  'Sala habitual da materia. NULL = ninguem informou ainda.';
COMMENT ON COLUMN materia.professor IS
  'Nome de quem da a materia. NULL = ninguem informou ainda.';

ALTER TABLE evento
  ADD COLUMN sala TEXT NULL;

COMMENT ON COLUMN evento.sala IS
  'Sala DESTE evento quando difere da habitual. NULL = na sala da materia. '
  'Nao e um espelho de materia.sala: mudar a sala da disciplina nao pode '
  'reescrever onde as provas passadas aconteceram.';

ALTER TABLE material
  ADD COLUMN data_aula DATE NULL;

COMMENT ON COLUMN material.data_aula IS
  'De que aula este material e, pela data. NULL = nao se aplica ou ninguem '
  'informou. DATE e nao TIMESTAMPTZ de proposito: "a aula de 2 de setembro" e '
  'um dia, e guardar instante faria o fuso mover a aula de dia.';

-- Material de aula costuma ser lido em ordem cronológica ("o que foi dado nas
-- últimas semanas"). O índice parcial ignora o que não tem data, que é a maioria
-- do material adicional.
CREATE INDEX material_por_aula ON material (materia_id, data_aula DESC)
  WHERE data_aula IS NOT NULL AND excluido_em IS NULL;
