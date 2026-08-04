package com.projetofans.domain;

import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.support.TesteComPostgres;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Estes quatro testes verificam garantias do BANCO, nao da aplicacao.
 *
 * A diferenca importa: uma regra checada so no service some no dia em que alguem
 * escreve um caminho novo que esquece de checa-la. Uma regra no schema nao some.
 */
@Transactional
class SchemaTest extends TesteComPostgres {

    @Autowired private TurmaRepository turmas;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MembroRepository membros;
    @Autowired private MateriaRepository materias;
    @Autowired private JdbcTemplate jdbc;

    private Turma novaTurma(String codigo) {
        return turmas.saveAndFlush(new Turma(UUID.randomUUID(), "Turma " + codigo, "2026.2", codigo));
    }

    private Usuario novoUsuario(String email) {
        return usuarios.saveAndFlush(
            Usuario.comSenha(UUID.randomUUID(), "Fulano", email, "$2a$10$hashfalso"));
    }

    @Test
    @DisplayName("o banco recusa dois LIDER na mesma turma")
    void naoPermiteDoisLideresNaMesmaTurma() {
        Turma turma = novaTurma("LID-" + UUID.randomUUID());
        Usuario a = novoUsuario("a-" + UUID.randomUUID() + "@ex.dev");
        Usuario b = novoUsuario("b-" + UUID.randomUUID() + "@ex.dev");

        membros.saveAndFlush(new Membro(UUID.randomUUID(), a.getId(), turma.getId(), PapelMembro.LIDER));

        assertThatThrownBy(() ->
            membros.saveAndFlush(new Membro(UUID.randomUUID(), b.getId(), turma.getId(), PapelMembro.LIDER)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("o banco recusa usuario sem senha e sem google_sub")
    void naoPermiteUsuarioSemNenhumaCredencial() {
        // Via SQL cru de proposito: as fabricas da entidade sempre preenchem uma
        // credencial, entao so o INSERT direto exercita o CHECK do banco.
        assertThatThrownBy(() -> jdbc.update(
            "insert into usuario (id, nome, email, senha_hash, google_sub) values (?, ?, ?, null, null)",
            UUID.randomUUID(), "Sem Credencial", "sem-" + UUID.randomUUID() + "@ex.dev"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("o banco recusa sigla repetida dentro da mesma turma")
    void naoPermiteSiglaDuplicadaNaMesmaTurma() {
        Turma turma = novaTurma("SIG-" + UUID.randomUUID());
        materias.saveAndFlush(new Materia(UUID.randomUUID(), turma.getId(), "Calculo II", "CALC2", "#1D4ED8"));

        assertThatThrownBy(() ->
            materias.saveAndFlush(
                new Materia(UUID.randomUUID(), turma.getId(), "Calculo 2 de novo", "CALC2", "#B91C1C")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("a mesma sigla e permitida em turmas diferentes")
    void permiteMesmaSiglaEmTurmasDiferentes() {
        // Junto com o teste anterior, este e o que prova que a unicidade e POR TURMA
        // e nao global — o que mantem a porta aberta para varias turmas depois sem
        // migration dolorosa.
        Turma umaTurma = novaTurma("T1-" + UUID.randomUUID());
        Turma outraTurma = novaTurma("T2-" + UUID.randomUUID());

        materias.saveAndFlush(new Materia(UUID.randomUUID(), umaTurma.getId(), "Calculo II", "CALC2", "#1D4ED8"));

        assertThatCode(() ->
            materias.saveAndFlush(
                new Materia(UUID.randomUUID(), outraTurma.getId(), "Calculo II", "CALC2", "#1D4ED8")))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("o banco recusa cor fora do formato hexadecimal")
    void naoPermiteCorForaDoFormatoHex() {
        Turma turma = novaTurma("COR-" + UUID.randomUUID());

        assertThatThrownBy(() ->
            materias.saveAndFlush(
                new Materia(UUID.randomUUID(), turma.getId(), "Cor Invalida", "XYZ", "azul")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("evento nao tem coluna de estado pessoal")
    void eventoNaoTemColunaFeito() {
        // Guardiao do nao-negociavel 3. Se alguem adicionar `feito` em evento para
        // simplificar uma query, este teste cai — que e exatamente o ponto.
        Integer colunas = jdbc.queryForObject("""
            select count(*) from information_schema.columns
            where table_name = 'evento' and column_name in ('feito', 'feito_em', 'visto')
            """, Integer.class);

        assertThat(colunas).isZero();
    }
}
