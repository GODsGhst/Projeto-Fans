-- Admin de plataforma: acima do líder, e concedido SÓ por SQL.
--
-- O PROBLEMA REAL QUE ISTO RESOLVE, E É UM SÓ
-- A liderança só se transfere pelas mãos do líder. Quando o líder some — troca
-- de faculdade, formatura, desiste do app — a turma fica sem ninguém que possa
-- ocultar conteúdo impróprio ou passar o cargo adiante, para sempre. Não há
-- caminho de volta dentro do produto: é um beco sem saída por desenho, e este
-- é o alçapão.
--
-- NENHUMA ROTA LIGA ESTA COLUNA, e essa é a decisão inteira.
-- Se existisse `POST /admin/promover`, ela seria o alvo mais valioso da API:
-- uma falha de autorização ali entregaria todas as turmas de uma vez. Sem rota,
-- virar admin exige acesso ao banco — que é uma credencial diferente, guardada
-- em outro lugar, e cujo uso deixa rastro fora da aplicação.
--
-- Conceder é, literalmente:
--   UPDATE usuario SET admin_plataforma = true WHERE email = 'quem@exemplo.com';
--
-- O QUE O ADMIN PODE, E O QUE ELE NÃO PODE
-- Pode: definir quem é líder de uma turma. Só isso.
-- NÃO pode: ler, criar, editar ou apagar conteúdo de turma nenhuma. O poder é
-- de destravar, não de vigiar — um admin que lê as provas e os rascunhos de
-- todo mundo é um problema maior que a turma travada que ele veio resolver.

ALTER TABLE usuario
  ADD COLUMN admin_plataforma BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN usuario.admin_plataforma IS
  'Admin de plataforma. Concedido SOMENTE por SQL: nenhuma rota da API escreve '
  'nesta coluna, de proposito. Da um unico poder — definir o lider de uma '
  'turma — para destravar turma cujo lider sumiu. Nao da acesso a conteudo.';
