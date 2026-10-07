-- Professor e coordenador (spec 2026-10-06-professor-coordenador, Secao 3.1).
--
-- Esta migration so cria a BASE: colunas, constraints e a tabela de "quem
-- leciona o que". Nenhuma regra de negocio mora aqui; quem decide o que cada
-- papel pode e o servidor, a partir destes dados.

-- Tipo da conta + aprovacao. So o admin muda o status, por rota (PC3).
-- O tipo existe desde o cadastro; o status e que guarda se o PODER ja foi
-- liberado. Aluno nunca tem status; docente sempre tem (CHECK abaixo), assim
-- nao existe "docente sem estado" para o codigo ter de adivinhar.
ALTER TABLE usuario
  ADD COLUMN tipo_conta           TEXT        NOT NULL DEFAULT 'ALUNO',
  ADD COLUMN docente_status       TEXT        NULL,
  ADD COLUMN docente_decidido_por UUID        NULL REFERENCES usuario(id),
  ADD COLUMN docente_decidido_em  TIMESTAMPTZ NULL,
  ADD CONSTRAINT usuario_tipo_conta_valido
    CHECK (tipo_conta IN ('ALUNO','PROFESSOR','COORDENADOR')),
  ADD CONSTRAINT usuario_docente_status_valido
    CHECK (docente_status IN ('PENDENTE','APROVADO','RECUSADO')),
  -- aluno nunca tem status; docente sempre tem
  ADD CONSTRAINT usuario_status_so_de_docente
    CHECK ((tipo_conta = 'ALUNO') = (docente_status IS NULL));

-- COORDENADOR entra no papel. O CHECK da V1 nao se edita (migration aplicada e
-- imutavel), entao ele e trocado aqui por DROP/ADD. Nenhuma rota grava PROFESSOR
-- hoje, entao nao ha linha legada a migrar; e uma que existisse ficaria sem
-- poder, porque o poder exige tipo_conta aprovado no usuario.
ALTER TABLE membro DROP CONSTRAINT membro_papel_valido;
ALTER TABLE membro ADD CONSTRAINT membro_papel_valido
  CHECK (papel IN ('ALUNO','LIDER','PROFESSOR','COORDENADOR'));

-- Contestacao do lider (2.4): o rastro mora na propria linha do vinculo, porque
-- a contestacao vale POR TURMA e entrar de novo com o codigo nao pode limpa-la
-- (o vinculo e unico por usuario+turma, a linha continua a mesma).
-- "Contestado" = docente_contestado_em IS NOT NULL; nao ha boolean separado
-- para nao existirem dois campos que possam divergir.
ALTER TABLE membro
  ADD COLUMN docente_contestado_em  TIMESTAMPTZ NULL,
  ADD COLUMN docente_contestado_por UUID        NULL REFERENCES usuario(id);

-- Quem leciona o que. A turma vem da materia (materia.turma_id); nao repete
-- turma_id aqui para nao haver duas verdades que possam discordar.
--
-- ON DELETE CASCADE nas duas pontas, ao contrario do resto do schema, de
-- proposito: isto e CONFIGURACAO do docente, nao fato compartilhado (o
-- nao-negociavel 2 fala de evento e material). O lider apaga fisicamente uma
-- materia vazia (MateriaService.excluir); sem o CASCADE, uma declaracao de
-- professor faria essa exclusao estourar a FK num 500.
CREATE TABLE professor_materia (
  usuario_id    UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  materia_id    UUID        NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
  declarado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, materia_id)
);

-- A PK cobre "materias deste professor"; este indice cobre o outro sentido,
-- "quem leciona esta materia", que PoderNaTurma.daTurma e a exclusao de materia
-- (o CASCADE precisa achar as linhas) usam.
CREATE INDEX professor_materia_por_materia ON professor_materia (materia_id);
