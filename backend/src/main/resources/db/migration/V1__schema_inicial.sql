-- projetoFans — schema inicial
--
-- Duas decisoes deste arquivo merecem explicacao, porque nao sao obvias:
--
-- 1. Enums sao TEXT + CHECK, nao CREATE TYPE ... AS ENUM.
--    O spec original pedia enum nativo do Postgres. Trocado porque enum nativo
--    com ddl-auto:validate do Hibernate e fonte conhecida de atrito de mapeamento,
--    e porque adicionar um valor depois vira ALTER TYPE em vez de trocar um CHECK.
--
-- 2. estado_pessoal e tabela separada, e isso e o ponto.
--    A regra 3 do handoff proibe gravar estado pessoal dentro do fato compartilhado.
--    Como nao existe coluna `feito` em evento, a regra deixa de depender de
--    disciplina e passa a ser algo que o banco recusa violar.

CREATE TABLE turma (
  id              UUID        PRIMARY KEY,
  nome            TEXT        NOT NULL,
  semestre        TEXT        NOT NULL,
  codigo_convite  TEXT        NOT NULL UNIQUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id          UUID        PRIMARY KEY,
  nome        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  senha_hash  TEXT        NULL,          -- NULL quando entrou por Google
  google_sub  TEXT        NULL UNIQUE,   -- NULL quando entrou por e-mail+senha
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuario_tem_credencial
    CHECK (senha_hash IS NOT NULL OR google_sub IS NOT NULL)
);

CREATE TABLE membro (
  id          UUID        PRIMARY KEY,
  usuario_id  UUID        NOT NULL REFERENCES usuario(id),
  turma_id    UUID        NOT NULL REFERENCES turma(id),
  papel       TEXT        NOT NULL DEFAULT 'ALUNO',
  entrou_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT membro_papel_valido CHECK (papel IN ('ALUNO','LIDER','PROFESSOR')),
  CONSTRAINT membro_vinculo_unico UNIQUE (usuario_id, turma_id)
);

-- Exatamente um LIDER por turma, garantido pelo banco e nao pela aplicacao.
-- Transferencia de lideranca precisa rebaixar e promover na MESMA transacao,
-- senao este indice estoura no meio.
CREATE UNIQUE INDEX membro_um_lider_por_turma
  ON membro (turma_id) WHERE papel = 'LIDER';

CREATE TABLE materia (
  id         UUID        PRIMARY KEY,
  turma_id   UUID        NOT NULL REFERENCES turma(id),
  nome       TEXT        NOT NULL,
  sigla      TEXT        NOT NULL,
  cor_hex    TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- unicidade POR TURMA, nao global: e o que mantem a porta aberta para
  -- varias turmas depois sem migration dolorosa
  CONSTRAINT materia_sigla_unica_na_turma UNIQUE (turma_id, sigla),
  CONSTRAINT materia_cor_hex_valida CHECK (cor_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE evento (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  materia_id     UUID        NOT NULL REFERENCES materia(id),
  tipo           TEXT        NOT NULL,
  titulo         TEXT        NOT NULL,
  data_evento    DATE        NOT NULL,
  hora_evento    TIME        NULL,       -- opcional de proposito: obrigar hora faz inventar dado
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  visivel_turma  BOOLEAN     NOT NULL DEFAULT true,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT evento_tipo_valido CHECK (tipo IN ('PROVA','ENTREGA'))
);

CREATE INDEX evento_feed ON evento (turma_id, data_evento)
  WHERE visivel_turma AND excluido_em IS NULL;

CREATE TABLE material (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  materia_id     UUID        NOT NULL REFERENCES materia(id),
  tipo           TEXT        NOT NULL,
  titulo         TEXT        NOT NULL,
  url            TEXT        NULL,
  arquivo_ref    TEXT        NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version        INTEGER     NOT NULL DEFAULT 0,
  visivel_turma  BOOLEAN     NOT NULL DEFAULT true,
  excluido_em    TIMESTAMPTZ NULL,
  CONSTRAINT material_tipo_valido CHECK (tipo IN ('AULA','ADICIONAL')),
  -- No MVP upload nao esta implementado, entao arquivo_ref e sempre NULL e o
  -- DTO exige url. A coluna existe para que ligar upload depois seja uma
  -- tarefa, e nao uma migration de dados.
  CONSTRAINT material_tem_conteudo CHECK (url IS NOT NULL OR arquivo_ref IS NOT NULL)
);

CREATE INDEX material_por_materia ON material (materia_id, tipo)
  WHERE visivel_turma AND excluido_em IS NULL;

-- Vinculo N:N. E daqui que sai a resposta "o que estudar pra essa prova".
CREATE TABLE evento_material (
  evento_id      UUID        NOT NULL REFERENCES evento(id),
  material_id    UUID        NOT NULL REFERENCES material(id),
  vinculado_por  UUID        NOT NULL REFERENCES usuario(id),
  vinculado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, material_id)
);

-- Estado pessoal. NUNCA uma coluna em evento.
CREATE TABLE estado_pessoal (
  usuario_id  UUID        NOT NULL REFERENCES usuario(id),
  evento_id   UUID        NOT NULL REFERENCES evento(id),
  feito       BOOLEAN     NOT NULL DEFAULT false,
  feito_em    TIMESTAMPTZ NULL,
  PRIMARY KEY (usuario_id, evento_id)
);

-- Historico de edicao. Regra 2: editar nao apaga o que havia antes.
CREATE TABLE revisao (
  id             UUID        PRIMARY KEY,
  registro_tipo  TEXT        NOT NULL,
  registro_id    UUID        NOT NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  acao           TEXT        NOT NULL,
  snapshot       JSONB       NOT NULL,
  CONSTRAINT revisao_registro_tipo_valido CHECK (registro_tipo IN ('EVENTO','MATERIAL')),
  CONSTRAINT revisao_acao_valida CHECK (acao IN ('CRIAR','EDITAR','EXCLUIR'))
);

CREATE INDEX revisao_registro ON revisao (registro_tipo, registro_id, em DESC);

-- Moderacao posterior ao fato. O lider muda visibilidade, nunca conteudo.
CREATE TABLE acao_moderacao (
  id             UUID        PRIMARY KEY,
  registro_tipo  TEXT        NULL,   -- NULL em TRANSFERIR_LIDERANCA
  registro_id    UUID        NULL,
  acao           TEXT        NOT NULL,
  lider_id       UUID        NOT NULL REFERENCES usuario(id),
  em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo         TEXT        NULL,
  CONSTRAINT acao_moderacao_valida
    CHECK (acao IN ('OCULTAR','REEXIBIR','PEDIR_EXCLUSAO','TRANSFERIR_LIDERANCA')),
  CONSTRAINT acao_moderacao_alvo_coerente
    CHECK ((acao = 'TRANSFERIR_LIDERANCA' AND registro_tipo IS NULL AND registro_id IS NULL)
        OR (acao <> 'TRANSFERIR_LIDERANCA' AND registro_tipo IS NOT NULL AND registro_id IS NOT NULL))
);

CREATE TABLE device_token (
  id             UUID        PRIMARY KEY,
  usuario_id     UUID        NOT NULL REFERENCES usuario(id),
  fcm_token      TEXT        NOT NULL UNIQUE,
  plataforma     TEXT        NOT NULL,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT device_plataforma_valida CHECK (plataforma IN ('android','ios','web'))
);

-- Token de reset de senha, uso unico.
CREATE TABLE token_reset_senha (
  id          UUID        PRIMARY KEY,
  usuario_id  UUID        NOT NULL REFERENCES usuario(id),
  token_hash  TEXT        NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado_em    TIMESTAMPTZ NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
