-- Anotação presa a um dia.
--
-- O componente de tela existe desde o começo, testado, sem nunca ter tido o que
-- desenhar: não havia tabela, rota nem repositório. Esta migration é o que
-- estava faltando embaixo dele.
--
-- DUAS COISAS DIFERENTES NA MESMA TABELA, E A COLUNA QUE AS SEPARA
-- `alcance = 'TURMA'`   → todo mundo lê. É recado.
-- `alcance = 'PESSOAL'` → só o autor lê. É rascunho.
--
-- Elas dividem a tabela porque são a mesma coisa para o banco — texto num dia —
-- e são coisas opostas para quem lê. O servidor NUNCA devolve uma PESSOAL para
-- quem não a escreveu; é a única regra que não pode falhar aqui, e por isso
-- mora na query e num teste, não numa camada de apresentação.
--
-- O QUE ESTA TABELA NÃO TEM
-- `visivel_turma`. Moderação de anotação ficou de fora por ora: o líder oculta
-- evento e material, e nota da turma ainda não passa por ele. Está escrito aqui
-- porque é uma lacuna conhecida, não um esquecimento — e o dia em que entrar,
-- entra como as outras, com a coluna e o RegistroTipo.

CREATE TABLE nota (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  alcance        TEXT        NOT NULL,
  data_nota      DATE        NOT NULL,
  texto          TEXT        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT nota_alcance_valido CHECK (alcance IN ('TURMA', 'PESSOAL')),
  CONSTRAINT nota_texto_nao_vazio CHECK (length(btrim(texto)) > 0)
);

-- A consulta é sempre "as notas desta turma naquele mês". Sem este índice ela
-- varre a tabela inteira, que cresce com todo rascunho pessoal de todo mundo —
-- e os pessoais são a maioria das linhas e o que ninguém mais vai ler.
CREATE INDEX nota_por_turma_e_dia ON nota (turma_id, data_nota)
  WHERE excluido_em IS NULL;

COMMENT ON COLUMN nota.alcance IS
  'TURMA = todo mundo le. PESSOAL = so o autor, e o servidor nunca devolve a '
  'de outra pessoa. A diferenca e de privacidade, nao de apresentacao.';
