package com.projetofans.admin;

import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O alcapao da plataforma.
 *
 * O caso que ele existe para resolver: o lider some e a turma fica sem ninguem
 * que possa ocultar conteudo ou passar o cargo. Nao ha caminho de volta dentro
 * do produto — e por isso o alcapao.
 *
 * REPARE COMO O ADMIN E CRIADO NESTE TESTE: por UPDATE direto no banco. Nao ha
 * outro jeito, e essa e a propriedade que o teste prova junto com o resto. Se
 * um dia aparecer uma rota que promove admin, este setup vai parecer
 * desnecessario — e sera o sinal de que a decisao foi desfeita.
 */
class AdminTest extends TesteDeApi {

    @Autowired
    private EntityManager em;

    private Turma turma;
    private Usuario lider;
    private Usuario aluno;
    private Usuario admin;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        lider = membroDe(turma, "Lider", PapelMembro.LIDER);
        aluno = membroDe(turma, "Aluno", PapelMembro.ALUNO);
        admin = novoUsuario("Admin");
        promoverPorSql(admin);
    }

    /** O unico jeito de virar admin. Nenhuma rota escreve nesta coluna. */
    private void promoverPorSql(Usuario usuario) {
        em.createNativeQuery("UPDATE usuario SET admin_plataforma = true WHERE id = :id")
                .setParameter("id", usuario.getId())
                .executeUpdate();
        em.flush();
        em.clear();
    }

    private org.springframework.test.web.servlet.ResultActions definirLider(
            Usuario quemPede, Usuario novoLider) throws Exception {
        return http.perform(post("/api/v1/admin/turmas/" + turma.getId() + "/lider")
                .header("Authorization", bearer(quemPede))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("novoLiderUsuarioId", novoLider.getId().toString()))));
    }

    private PapelMembro papelDe(Usuario usuario) {
        em.clear();
        return membros.findByUsuarioIdAndTurmaId(usuario.getId(), turma.getId())
                .orElseThrow().getPapel();
    }

    @Test
    @DisplayName("o admin destrava a turma: o aluno vira lider e o antigo e rebaixado")
    void destravaATurma() throws Exception {
        definirLider(admin, aluno).andExpect(status().isNoContent());

        assertThat(papelDe(aluno)).isEqualTo(PapelMembro.LIDER);
        assertThat(papelDe(lider)).isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("funciona tambem na turma que JA esta sem lider — que e o caso real")
    void turmaSemLider() throws Exception {
        // O lider some de verdade: o vinculo dele deixa de existir. E aqui que
        // a turma fica travada, porque a transferencia normal exige um lider.
        membros.delete(membros.findByUsuarioIdAndTurmaId(lider.getId(), turma.getId())
                .orElseThrow());
        membros.flush();

        definirLider(admin, aluno).andExpect(status().isNoContent());

        assertThat(papelDe(aluno)).isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("para quem nao e admin, a rota nao existe — 404, e nao 403")
    void naoAdminRecebe404() throws Exception {
        // 403 confirmaria que a rota esta ali e que ha um poder a alcancar.
        definirLider(lider, aluno).andExpect(status().isNotFound());
        definirLider(aluno, aluno).andExpect(status().isNotFound());

        assertThat(papelDe(lider)).isEqualTo(PapelMembro.LIDER);
        assertThat(papelDe(aluno)).isEqualTo(PapelMembro.ALUNO);
    }

    @Test
    @DisplayName("o admin nao coloca gente na turma: o novo lider precisa ja ser membro")
    void precisaSerMembro() throws Exception {
        Usuario deFora = novoUsuario("De fora");

        definirLider(admin, deFora).andExpect(status().isNotFound());

        assertThat(papelDe(lider)).isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("nenhuma rota promove admin — o poder so entra por SQL")
    void naoHaComoVirarAdminPelaApi() throws Exception {
        // Se um dia alguem adicionar `POST /admin/promover`, este teste falha e
        // a conversa acontece antes do merge, que e o ponto dele.
        http.perform(post("/api/v1/admin/promover")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(
                                Map.of("usuarioId", aluno.getId().toString()))))
                .andExpect(status().isNotFound());

        em.clear();
        assertThat(usuarios.findById(aluno.getId()).orElseThrow().isAdminPlataforma())
                .isFalse();
    }
}
