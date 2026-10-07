-- Quem editou o registro (spec 2026-10-06-professor-coordenador, Secao 3.2).
--
-- NULL = nunca editado, ou legado. Preenchido em TODA edicao, inclusive a do autor;
-- a API so mostra "editado por" quando difere de autor_id.

ALTER TABLE evento   ADD COLUMN atualizado_por UUID NULL REFERENCES usuario(id);
ALTER TABLE material ADD COLUMN atualizado_por UUID NULL REFERENCES usuario(id);
