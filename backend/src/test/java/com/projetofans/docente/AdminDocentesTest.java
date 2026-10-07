package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PC3 — o admin decide quem e docente. P15 e a parte de P16 que cabe a esta tarefa
 * (o status vem do banco, nao do JWT).
 *
 * O teste que mais importa e o de nao-admin: se um docente pendente conseguisse
 * aprovar a si mesmo, o "pendente" da spec 2.1 seria enfeite. Como em AdminTest, o
 * admin nasce por UPDATE direto no banco — nenhuma rota promove.
 */
class AdminDocentesTest extends TesteDeApi {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;

    private Usuario admin;

    @BeforeEach
    void cenario() {
        admin = novoUsuario("Admin");
        jdbc.update("update usuario set admin_plataforma = true where id = ?", admin.getId());
    }

    /**
     * flush ANTES de clear: o save() do service e um merge, que so vira SQL no flush.
     * Limpar sem gravar jogaria fora a decisao que o teste acabou de provocar.
     */
    private void limpar() {
        em.flush();
        em.clear();
    }

    private Usuario novoDocente(String nome, TipoConta tipo) {
        return usuarios.saveAndFlush(Usuario.comSenha(
                UUID.randomUUID(), nome, "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
    }

    private ResultActions lista(Usuario quem, String query) throws Exception {
        limpar();
        return http.perform(get("/api/v1/admin/docentes" + query).header("Authorization", bearer(quem)));
    }

    private ResultActions decide(Usuario quem, UUID alvo, String acao) throws Exception {
        limpar();
        return http.perform(post("/api/v1/admin/docentes/" + alvo + "/" + acao)
                .header("Authorization", bearer(quem)));
    }

    private Usuario doBanco(Usuario u) {
        limpar();
        return usuarios.findById(u.getId()).orElseThrow();
    }

    private List<String> ids(ResultActions r) throws Exception {
        JsonNode lista = json.readTree(
                r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> ids = new ArrayList<>();
        lista.forEach(item -> ids.add(item.get("usuarioId").asText()));
        return ids;
    }

    // ---- P15: so admin; para o resto a rota nao existe (404, nunca 403) --------

    @Test
    @DisplayName("P15 — quem nao e admin recebe 404 nas tres rotas, e nada muda")
    void naoAdminRecebe404() throws Exception {
        Usuario aluno = novoUsuario("Aluno");
        Usuario pendente = novoDocente("Prof pendente", TipoConta.PROFESSOR);
        Usuario aprovado = novoDocente("Prof aprovado", TipoConta.PROFESSOR);
        aprovado.decidirDocente(true, admin.getId(), Instant.now());
        usuarios.saveAndFlush(aprovado);

        for (Usuario intruso : List.of(aluno, pendente, aprovado)) {
            lista(intruso, "").andExpect(status().isNotFound());
            decide(intruso, pendente.getId(), "aprovar").andExpect(status().isNotFound());
            decide(intruso, aprovado.getId(), "recusar").andExpect(status().isNotFound());
        }

        // o ataque que a spec 2.1 existe para barrar: aprovar a si mesmo
        assertThat(doBanco(pendente).getDocenteStatus()).isEqualTo(DocenteStatus.PENDENTE);
        assertThat(doBanco(pendente).getDocenteDecididoPor()).isNull();
        assertThat(doBanco(aprovado).getDocenteStatus()).isEqualTo(DocenteStatus.APROVADO);
    }

    @Test
    @DisplayName("sem token -> 401 nas tres rotas")
    void semTokenDa401() throws Exception {
        http.perform(get("/api/v1/admin/docentes")).andExpect(status().isUnauthorized());
        http.perform(post("/api/v1/admin/docentes/" + UUID.randomUUID() + "/aprovar"))
                .andExpect(status().isUnauthorized());
        http.perform(post("/api/v1/admin/docentes/" + UUID.randomUUID() + "/recusar"))
                .andExpect(status().isUnauthorized());
    }

    // ---- aprovar / recusar -----------------------------------------------------

    @Test
    @DisplayName("P15 — aprovar grava APROVADO, quem decidiu e quando; devolve 204")
    void aprovarGravaORastro() throws Exception {
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);

        decide(admin, prof.getId(), "aprovar").andExpect(status().isNoContent());

        Usuario lido = doBanco(prof);
        assertThat(lido.getDocenteStatus()).isEqualTo(DocenteStatus.APROVADO);
        assertThat(lido.getDocenteDecididoPor()).isEqualTo(admin.getId());
        assertThat(lido.getDocenteDecididoEm()).isNotNull();
        assertThat(lido.getTipoConta()).isEqualTo(TipoConta.PROFESSOR);
        assertThat(lido.getSenhaHash()).as("a decisao nao pode regravar o resto da linha").isEqualTo("hash");
    }

    @Test
    @DisplayName("P15 — recusar um pendente grava RECUSADO com o rastro")
    void recusarPendente() throws Exception {
        Usuario coord = novoDocente("Coord", TipoConta.COORDENADOR);

        decide(admin, coord.getId(), "recusar").andExpect(status().isNoContent());

        Usuario lido = doBanco(coord);
        assertThat(lido.getDocenteStatus()).isEqualTo(DocenteStatus.RECUSADO);
        assertThat(lido.getDocenteDecididoPor()).isEqualTo(admin.getId());
        assertThat(lido.getDocenteDecididoEm()).isNotNull();
    }

    @Test
    @DisplayName("recusar tambem REVOGA um aprovado, e a decisao e reversivel")
    void recusarRevogaEAprovarReverte() throws Exception {
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);
        decide(admin, prof.getId(), "aprovar").andExpect(status().isNoContent());

        decide(admin, prof.getId(), "recusar").andExpect(status().isNoContent());
        assertThat(doBanco(prof).getDocenteStatus()).isEqualTo(DocenteStatus.RECUSADO);

        decide(admin, prof.getId(), "aprovar").andExpect(status().isNoContent());
        assertThat(doBanco(prof).getDocenteStatus()).isEqualTo(DocenteStatus.APROVADO);
    }

    @Test
    @DisplayName("P16 (parte) — a decisao vale na proxima requisicao com o MESMO token: o status vem do banco")
    void statusNaoVemDoJwt() throws Exception {
        Usuario prof = novoDocente("Prof", TipoConta.PROFESSOR);
        String tokenDoProf = bearer(prof);   // emitido ANTES de qualquer decisao

        decide(admin, prof.getId(), "aprovar").andExpect(status().isNoContent());
        assertThat(statusVisto(tokenDoProf)).isEqualTo("APROVADO");

        decide(admin, prof.getId(), "recusar").andExpect(status().isNoContent());
        assertThat(statusVisto(tokenDoProf)).isEqualTo("RECUSADO");
    }

    private String statusVisto(String bearer) throws Exception {
        limpar();
        return json.readTree(http.perform(get("/api/v1/eu").header("Authorization", bearer))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("docenteStatus").asText();
    }

    @Test
    @DisplayName("conta ALUNO nao tem o que aprovar nem recusar: 404, e continua sem status")
    void alunoNaoEDocente() throws Exception {
        Usuario aluno = novoUsuario("Aluno");

        decide(admin, aluno.getId(), "aprovar").andExpect(status().isNotFound());
        decide(admin, aluno.getId(), "recusar").andExpect(status().isNotFound());

        assertThat(doBanco(aluno).getDocenteStatus()).isNull();
    }

    @Test
    @DisplayName("id que nao existe -> 404")
    void idInexistente() throws Exception {
        decide(admin, UUID.randomUUID(), "aprovar").andExpect(status().isNotFound());
        decide(admin, UUID.randomUUID(), "recusar").andExpect(status().isNotFound());
    }

    // ---- listagem --------------------------------------------------------------

    @Test
    @DisplayName("lista por status: so docentes, nunca aluno, e o filtro separa pendente de aprovado")
    void listaFiltraPorStatus() throws Exception {
        Usuario aluno = novoUsuario("Aluno");
        Usuario pendente = novoDocente("Prof pendente", TipoConta.PROFESSOR);
        Usuario aprovado = novoDocente("Coord aprovada", TipoConta.COORDENADOR);
        Usuario recusado = novoDocente("Prof recusado", TipoConta.PROFESSOR);
        decide(admin, aprovado.getId(), "aprovar").andExpect(status().isNoContent());
        decide(admin, recusado.getId(), "recusar").andExpect(status().isNoContent());

        List<String> soPendentes = ids(lista(admin, "?status=PENDENTE"));
        assertThat(soPendentes).contains(pendente.getId().toString())
                .doesNotContain(aprovado.getId().toString(), recusado.getId().toString());

        List<String> soAprovados = ids(lista(admin, "?status=APROVADO"));
        assertThat(soAprovados).contains(aprovado.getId().toString())
                .doesNotContain(pendente.getId().toString(), recusado.getId().toString());

        List<String> soRecusados = ids(lista(admin, "?status=RECUSADO"));
        assertThat(soRecusados).contains(recusado.getId().toString())
                .doesNotContain(pendente.getId().toString(), aprovado.getId().toString());

        List<String> todos = ids(lista(admin, ""));
        assertThat(todos).contains(pendente.getId().toString(), aprovado.getId().toString(),
                        recusado.getId().toString())
                .doesNotContain(aluno.getId().toString(), admin.getId().toString());
    }

    @Test
    @DisplayName("cada linha traz so conta (id, nome, e-mail, tipo, status, criadoEm) — nada de senha")
    void linhaDaLista() throws Exception {
        Usuario prof = novoDocente("Prof Souza", TipoConta.PROFESSOR);

        JsonNode lista = json.readTree(lista(admin, "?status=PENDENTE")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode linha = null;
        for (JsonNode item : lista) {
            if (item.get("usuarioId").asText().equals(prof.getId().toString())) {
                linha = item;
            }
        }

        assertThat(linha).isNotNull();
        assertThat(linha.get("nome").asText()).isEqualTo("Prof Souza");
        assertThat(linha.get("email").asText()).isEqualTo(prof.getEmail());
        assertThat(linha.get("tipoConta").asText()).isEqualTo("PROFESSOR");
        assertThat(linha.get("docenteStatus").asText()).isEqualTo("PENDENTE");
        assertThat(linha.get("criadoEm").asText()).isNotBlank();
        assertThat(linha.has("senhaHash")).isFalse();
        assertThat(linha.has("googleSub")).isFalse();
        assertThat(linha.size()).isEqualTo(6);
    }

    @Test
    @DisplayName("a fila mostra a conta que espera ha mais tempo primeiro")
    void maisAntigoPrimeiro() throws Exception {
        Usuario novo = novoDocente("Novo", TipoConta.PROFESSOR);
        Usuario velho = novoDocente("Velho", TipoConta.PROFESSOR);
        jdbc.update("update usuario set criado_em = now() - interval '2 days' where id = ?", velho.getId());
        jdbc.update("update usuario set criado_em = now() - interval '1 day' where id = ?", novo.getId());

        List<String> ordem = ids(lista(admin, "?status=PENDENTE"));

        assertThat(ordem.indexOf(velho.getId().toString()))
                .isGreaterThanOrEqualTo(0)
                .isLessThan(ordem.indexOf(novo.getId().toString()));
    }

    @Test
    @DisplayName("status fora da lista -> 400")
    void statusInvalido() throws Exception {
        lista(admin, "?status=TALVEZ").andExpect(status().isBadRequest());
    }
}
