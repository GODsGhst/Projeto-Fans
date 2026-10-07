package com.projetofans.docente;

import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Os dois limites que faltavam no cadastro docente (achado LOW da revisao de
 * 07/10/2026): cadastro sem teto por e-mail, e conta docente PENDENTE criando turma
 * sem parar. Nenhum dos dois da poder a ninguem sozinho, mas o cadastro docente e
 * aberto e o e-mail nao e verificado (A27) — sem teto, e a porta de spam e de
 * chute no mesmo e-mail.
 */
class LimitesDoCadastroDocenteTest extends TesteDeApi {

    private MvcResult enviar(String rota, String bearer, Map<String, Object> corpo) throws Exception {
        var pedido = post(rota).contentType(MediaType.APPLICATION_JSON).content(corpo(corpo));
        if (bearer != null) {
            pedido.header("Authorization", bearer);
        }
        return http.perform(pedido).andReturn();
    }

    private static String email() {
        return "cadastro-" + UUID.randomUUID() + "@ex.dev";
    }

    private MvcResult registrar(String nome, String email) throws Exception {
        return enviar("/api/v1/auth/registrar", null, Map.of("nome", nome, "email", email,
                "senha", "senha-boa-123", "tipoConta", "PROFESSOR"));
    }

    private MvcResult criarTurma(Usuario docente) throws Exception {
        return enviar("/api/v1/turmas", bearer(docente), Map.of("nome", "Turma", "semestre", "2026.2"));
    }

    private Usuario docente() {
        return usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), "Docente",
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", TipoConta.PROFESSOR));
    }

    // ---- /auth/registrar --------------------------------------------------------

    @Test
    @DisplayName("registrar: o sexto pedido com o mesmo e-mail e 429, com e sem conta, e o corpo do 429 e o mesmo")
    void registrarTemTetoPorEmail() throws Exception {
        String comConta = email();
        assertThat(registrar("Ana", comConta).getResponse().getStatus()).isEqualTo(200);
        for (int i = 0; i < 4; i++) {
            assertThat(registrar("Ana", comConta).getResponse().getStatus()).isEqualTo(409);
        }

        // Nome so de pontuacao e recusado (400) ANTES de existir conta: este e-mail nunca a tera.
        String semConta = email();
        for (int i = 0; i < 5; i++) {
            assertThat(registrar("!!!", semConta).getResponse().getStatus()).isEqualTo(400);
        }

        MvcResult comContaBloqueada = registrar("Ana", comConta);
        MvcResult semContaBloqueada = registrar("!!!", semConta);
        assertThat(comContaBloqueada.getResponse().getStatus()).isEqualTo(429);
        assertThat(semContaBloqueada.getResponse().getStatus()).isEqualTo(429);
        // Mesma resposta nos dois: o teto nao pode virar uma forma nova de saber quem tem conta.
        assertThat(comContaBloqueada.getResponse().getContentAsString())
                .isEqualTo(semContaBloqueada.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("registrar: o teto e por e-mail (outro e-mail segue livre) e ignora caixa alta")
    void registrarTetoEPorEmail() throws Exception {
        String alvo = email();
        for (int i = 0; i < 5; i++) {
            registrar("Ana", alvo);
        }

        assertThat(registrar("Ana", alvo.toUpperCase()).getResponse().getStatus())
                .as("mesmo e-mail, escrito de outro jeito").isEqualTo(429);
        assertThat(registrar("Bia", email()).getResponse().getStatus()).isEqualTo(200);
    }

    // ---- turmas criadas por conta docente nao aprovada ---------------------------

    @Test
    @DisplayName("docente PENDENTE cria 3 turmas; a quarta e 409 com a mensagem; aprovado, volta a criar")
    void pendenteTemTetoDeTurmasCriadas() throws Exception {
        Usuario docente = docente();
        for (int i = 0; i < 3; i++) {
            assertThat(criarTurma(docente).getResponse().getStatus()).isEqualTo(200);
        }

        MvcResult quarta = criarTurma(docente);

        assertThat(quarta.getResponse().getStatus()).isEqualTo(409);
        assertThat(json.readTree(quarta.getResponse().getContentAsString()).get("detail").asText())
                .isEqualTo("Aguarde a aprovacao para criar mais turmas");
        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(docente.getId()))
                .as("o 409 nao pode ter criado nada").hasSize(3);

        docente.decidirDocente(true, novoUsuario("Admin").getId(), Instant.now());
        usuarios.saveAndFlush(docente);

        assertThat(criarTurma(docente).getResponse().getStatus())
                .as("aprovada, o teto some").isEqualTo(200);
    }

    @Test
    @DisplayName("o teto conta turmas CRIADAS: entrar por codigo nao e barrado por ele nem gasta o de quem entra")
    void entrarNaoContaComoCriar() throws Exception {
        Usuario criadora = docente();
        Usuario visitante = docente();
        String[] codigos = new String[3];
        for (int i = 0; i < 3; i++) {
            codigos[i] = json.readTree(criarTurma(criadora).getResponse().getContentAsString())
                    .get("codigoConvite").asText();
        }
        assertThat(criarTurma(criadora).getResponse().getStatus()).as("criadora no teto").isEqualTo(409);

        for (String codigo : codigos) {
            assertThat(enviar("/api/v1/turmas/entrar", bearer(visitante), Map.of("codigoConvite", codigo))
                    .getResponse().getStatus()).as("entrar nao e criar").isEqualTo(200);
        }
        // Frequentar 3 turmas alheias nao gastou nenhuma das 3 criacoes do visitante...
        String codigoDoVisitante = null;
        for (int i = 0; i < 3; i++) {
            MvcResult criada = criarTurma(visitante);
            assertThat(criada.getResponse().getStatus()).isEqualTo(200);
            codigoDoVisitante = json.readTree(criada.getResponse().getContentAsString())
                    .get("codigoConvite").asText();
        }
        // ...e a quarta criada e que passa do teto.
        assertThat(criarTurma(visitante).getResponse().getStatus()).isEqualTo(409);
        // quem esta no teto de criar continua podendo entrar
        assertThat(enviar("/api/v1/turmas/entrar", bearer(criadora),
                Map.of("codigoConvite", codigoDoVisitante)).getResponse().getStatus()).isEqualTo(200);
    }
}
