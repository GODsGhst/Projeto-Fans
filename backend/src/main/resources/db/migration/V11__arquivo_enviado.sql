-- Envio de arquivo (apostila de upload): o aluno anexa PDF, PNG ou JPG a uma
-- prova ou entrega, e ele vira um material da turma com material.arquivo_ref
-- apontando para esta tabela. O CHECK material_tem_conteudo da V1 ja aceita
-- material sem url quando arquivo_ref existe.
--
-- O conteudo mora no proprio Postgres, e nao num bucket (a Task 15 previa R2
-- com URL pre-assinada): sem conta nova nem credencial, e o disco do Render
-- gratuito some a cada deploy. O teto de 5 MB por arquivo e do ArquivoService.
-- ponytail: bytea no banco da turma; mover para bucket se o volume crescer.
CREATE TABLE arquivo (
  id             UUID        PRIMARY KEY,
  turma_id       UUID        NOT NULL REFERENCES turma(id),
  nome           TEXT        NOT NULL,
  mime           TEXT        NOT NULL,
  tamanho_bytes  INTEGER     NOT NULL,
  conteudo       BYTEA       NOT NULL,
  autor_id       UUID        NOT NULL REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT arquivo_mime_valido CHECK (mime IN ('application/pdf', 'image/png', 'image/jpeg')),
  CONSTRAINT arquivo_tamanho_valido CHECK (tamanho_bytes > 0 AND tamanho_bytes = octet_length(conteudo))
);
