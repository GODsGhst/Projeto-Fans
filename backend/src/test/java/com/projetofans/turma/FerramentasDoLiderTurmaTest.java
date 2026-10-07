package com.projetofans.turma;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Remover membro e trocar o codigo de convite: as duas ferramentas da turma que
 * so o lider tem.
 *
 * O que estes testes seguram:
 *
 *  - quem sai perde o acesso NA HORA, mas o que postou fica com o nome dele
 *    (autoria visivel e nao-negociavel);
 *  - a ordem das checagens do projeto, escopo (404) antes de poder (403) antes de
 *    estado (409) — inverter vazaria que um usuario de outra turma existe;
 *  - o lider nao se remove (a turma ficaria sem lider);
 *  - o codigo antigo morre na hora e quem ja esta dentro nao sente nada.
 */
class FerramentasDoLiderTurmaTest extends TesteDeApi {

    private Turma turma;
    private Materia materia;
    private Usuario lider;
    private Usuario ana;
    private Usuario bruno;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        ana = membroDe(turma, "Ana", PapelMembro.ALUNO);
        bruno = membroDe(turma, "Bruno", PapelMembro.ALUNO);
    }

    private MvcResultStatus remover(Usuario quem, UUID alvo) throws Exception {
        MvcResult r = http.perform(delete("/api/v1/turmas/minha/membros/" + alvo)
                .header("Authorization", bearer(quem))).andReturn();
        return new MvcResultStatus(r);
    }

    private MvcResultStatus trocarCodigo(Usuario quem) throws Exception {
        MvcResult r = http.perform(post("/api/v1/turmas/minha/codigo")
                .header("Authorization", bearer(quem))).andReturn();
        return new MvcResultStatus(r);
    }

    /** Status e corpo de uma resposta, para as asserções ficarem em uma linha. */
    private final class MvcResultStatus {
        final int status;
        final String corpo;

        MvcResultStatus(MvcResult r) throws Exception {
            this.status = r.getResponse().getStatus();
            this.corpo = r.getResponse().getContentAsString();
        }

        JsonNode json() throws Exception {
            return FerramentasDoLiderTurmaTest.this.json.readTree(corpo);
        }
    }

    private List<String> nomesDosMembros(Usuario quem) throws Exception {
        MvcResult r = http.perform(get("/api/v1/turmas/minha").header("Authorization", bearer(quem)))
                .andExpect(status().isOk()).andReturn();
        List<String> nomes = new ArrayList<>();
        json.readTree(r.getResponse().getContentAsString()).get("membros")
                .forEach(m -> nomes.add(m.get("nome").asText()));
        return nomes;
    }

    private Evento eventoDe(Usuario dono, String titulo) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(3), null,
                dono.getId(), Instant.now()));
    }

    // ------------------------------------------------------------ remover membro

    @Test
    @DisplayName("lider remove um aluno: 204 e ele some da lista de membros")
    void liderRemoveAluno() throws Exception {
        MvcResultStatus r = remover(lider, ana.getId());

        assertThat(r.status).isEqualTo(204);
        assertThat(nomesDosMembros(lider)).containsExactlyInAnyOrder("Lia", "Bruno");
        assertThat(membros.findByUsuarioIdAndTurmaId(ana.getId(), turma.getId())).isEmpty();
    }

    @Test
    @DisplayName("o removido perde o acesso na hora: o proximo request dele e 404 de sem turma")
    void removidoPerdeOAcessoNaHora() throws Exception {
        remover(lider, ana.getId());

        // E o 404 que o app ja sabe ler como "voce nao esta em turma nenhuma" —
        // o mesmo de quem acabou de se cadastrar. Nenhuma rota protegida abre.
        http.perform(get("/api/v1/turmas/minha").header("Authorization", bearer(ana)))
                .andExpect(status().isNotFound());
        http.perform(get("/api/v1/home").header("Authorization", bearer(ana)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("so o 404 de quem esta sem turma leva codigo SEM_TURMA — e o texto e o mesmo dos outros 404")
    void soOSemTurmaLevaCodigo() throws Exception {
        remover(lider, ana.getId());
        Turma outra = novaTurma();
        Usuario deOutra = membroDe(outra, "Caio", PapelMembro.ALUNO);

        // O app so apaga a turma local diante deste codigo. Um 404 de proxy ou de
        // registro que sumiu nao pode ter esse poder, entao tem de vir sem ele.
        for (String rota : new String[] {"/api/v1/turmas/minha", "/api/v1/home", "/api/v1/sync"}) {
            JsonNode removido = json.readTree(http.perform(get(rota).header("Authorization", bearer(ana)))
                    .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString());
            assertThat(removido.path("codigo").asText()).as(rota).isEqualTo("SEM_TURMA");
            assertThat(removido.get("detail").asText()).isEqualTo("Registro nao encontrado");
        }

        JsonNode alheio = remover(lider, deOutra.getId()).json();
        assertThat(alheio.has("codigo")).as("404 de outra turma nao leva codigo").isFalse();
        assertThat(alheio.get("detail").asText()).isEqualTo("Registro nao encontrado");
    }

    @Test
    @DisplayName("o que o removido postou CONTINUA na turma, com o nome dele")
    void conteudoDoRemovidoContinuaComAutoria() throws Exception {
        Evento prova = eventoDe(ana, "Prova de Calculo");
        Material apostila = materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(),
                materia.getId(), TipoMaterial.AULA, "Apostila", "https://ex.dev/apostila",
                ana.getId(), Instant.now()));

        remover(lider, ana.getId());

        // Autoria visivel e nao-negociavel: sair da turma nao anonimiza nem apaga.
        MvcResult r = http.perform(get("/api/v1/eventos/" + prova.getId())
                        .header("Authorization", bearer(bruno)))
                .andExpect(status().isOk()).andReturn();
        JsonNode evento = json.readTree(r.getResponse().getContentAsString());
        assertThat(evento.get("titulo").asText()).isEqualTo("Prova de Calculo");
        assertThat(evento.get("autoria").get("autorNome").asText()).isEqualTo("Ana");
        assertThat(evento.get("autoria").get("autorId").asText()).isEqualTo(ana.getId().toString());

        JsonNode detalhe = json.readTree(http.perform(get("/api/v1/materias/" + materia.getId())
                        .header("Authorization", bearer(bruno)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(detalhe.get("materiaisAula")).hasSize(1);
        assertThat(detalhe.get("materiaisAula").get(0).get("id").asText())
                .isEqualTo(apostila.getId().toString());
        assertThat(detalhe.get("materiaisAula").get(0).get("autoria").get("autorNome").asText())
                .isEqualTo("Ana");
    }

    @Test
    @DisplayName("aluno nao remove ninguem: 403, e o alvo continua na turma")
    void alunoNaoRemove() throws Exception {
        MvcResultStatus r = remover(bruno, ana.getId());

        assertThat(r.status).isEqualTo(403);
        assertThat(membros.findByUsuarioIdAndTurmaId(ana.getId(), turma.getId())).isPresent();
    }

    @Test
    @DisplayName("lider nao remove a si mesmo: 409 pedindo para transferir antes")
    void liderNaoSeRemove() throws Exception {
        MvcResultStatus r = remover(lider, lider.getId());

        assertThat(r.status).isEqualTo(409);
        assertThat(r.json().get("detail").asText()).contains("Transfira a lideranca");
        // A turma nao ficou sem lider.
        assertThat(membros.findByUsuarioIdAndTurmaId(lider.getId(), turma.getId()))
                .get().extracting("papel").isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("membro de OUTRA turma: 404, e continua la")
    void membroDeOutraTurmaLeva404() throws Exception {
        Turma outra = novaTurma();
        Usuario deOutra = membroDe(outra, "Caio", PapelMembro.ALUNO);

        MvcResultStatus r = remover(lider, deOutra.getId());

        assertThat(r.status).isEqualTo(404);
        assertThat(membros.findByUsuarioIdAndTurmaId(deOutra.getId(), outra.getId())).isPresent();
    }

    @Test
    @DisplayName("usuario que nao esta em turma nenhuma: 404, igual ao de outra turma")
    void usuarioInexistenteLeva404() throws Exception {
        assertThat(remover(lider, UUID.randomUUID()).status).isEqualTo(404);
        assertThat(remover(lider, novoUsuario("Sem Turma").getId()).status).isEqualTo(404);
    }

    @Test
    @DisplayName("escopo vem antes de poder: aluno tentando alguem de OUTRA turma leva 404, nao 403")
    void escopoAntesDePoder() throws Exception {
        // Se o 403 viesse primeiro, o aluno aprenderia pelo status que aquele
        // usuario existe em outra turma. 404 nos dois casos fecha o oraculo.
        Turma outra = novaTurma();
        Usuario deOutra = membroDe(outra, "Caio", PapelMembro.ALUNO);

        assertThat(remover(bruno, deOutra.getId()).status).isEqualTo(404);
    }

    @Test
    @DisplayName("quem nao tem turma leva 404 ao tentar remover")
    void semTurmaLeva404() throws Exception {
        assertThat(remover(novoUsuario("Solto"), ana.getId()).status).isEqualTo(404);
    }

    @Test
    @DisplayName("o removido pode entrar de novo com o codigo — por isso existe trocar o codigo")
    void removidoPodeVoltarComOMesmoCodigo() throws Exception {
        remover(lider, ana.getId());

        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", bearer(ana))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigoConvite\":\"" + turma.getCodigoConvite() + "\"}"))
                .andExpect(status().isOk());

        // Registrado para o review ver: remover NAO bane. Quem quer a pessoa fora
        // de vez troca o codigo logo depois (proximo grupo de testes).
    }

    // ------------------------------------------------------------- trocar codigo

    @Test
    @DisplayName("lider troca o codigo: 200, codigo novo e diferente, e a turma devolve o novo")
    void liderTrocaOCodigo() throws Exception {
        String antigo = turma.getCodigoConvite();

        MvcResultStatus r = trocarCodigo(lider);

        assertThat(r.status).isEqualTo(200);
        String novo = r.json().get("codigoConvite").asText();
        assertThat(novo).isNotBlank().isNotEqualTo(antigo);
        assertThat(turmas.findById(turma.getId())).get()
                .extracting("codigoConvite").isEqualTo(novo);
    }

    @Test
    @DisplayName("o codigo antigo para de funcionar na hora; o novo funciona")
    void codigoAntigoParaDeFuncionar() throws Exception {
        String antigo = turma.getCodigoConvite();
        String novo = trocarCodigo(lider).json().get("codigoConvite").asText();
        Usuario calouro = novoUsuario("Calouro");

        // 404 e nao 400/403: quem chuta codigo nao aprende nada sobre quais existem.
        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", bearer(calouro))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigoConvite\":\"" + antigo + "\"}"))
                .andExpect(status().isNotFound());
        assertThat(membros.findByUsuarioIdAndTurmaId(calouro.getId(), turma.getId())).isEmpty();

        http.perform(post("/api/v1/turmas/entrar")
                        .header("Authorization", bearer(calouro))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigoConvite\":\"" + novo + "\"}"))
                .andExpect(status().isOk());
        assertThat(membros.findByUsuarioIdAndTurmaId(calouro.getId(), turma.getId())).isPresent();
    }

    @Test
    @DisplayName("quem ja esta na turma nao e afetado pela troca")
    void quemJaEstaNaoEAfetado() throws Exception {
        String novo = trocarCodigo(lider).json().get("codigoConvite").asText();

        // Continua entrando nas rotas, e ve o codigo novo.
        MvcResult r = http.perform(get("/api/v1/turmas/minha").header("Authorization", bearer(ana)))
                .andExpect(status().isOk()).andReturn();
        JsonNode corpo = json.readTree(r.getResponse().getContentAsString());
        assertThat(corpo.get("codigoConvite").asText()).isEqualTo(novo);
        assertThat(nomesDosMembros(ana)).containsExactlyInAnyOrder("Lia", "Ana", "Bruno");
    }

    @Test
    @DisplayName("aluno nao troca o codigo: 403, e o codigo continua o mesmo")
    void alunoNaoTrocaOCodigo() throws Exception {
        String antigo = turma.getCodigoConvite();

        assertThat(trocarCodigo(ana).status).isEqualTo(403);

        assertThat(turmas.findById(turma.getId())).get()
                .extracting("codigoConvite").isEqualTo(antigo);
    }

    @Test
    @DisplayName("quem nao tem turma leva 404 ao tentar trocar o codigo")
    void semTurmaNaoTrocaCodigo() throws Exception {
        assertThat(trocarCodigo(novoUsuario("Solto")).status).isEqualTo(404);
    }

    @Test
    @DisplayName("trocar o codigo de uma turma nao mexe no da outra")
    void naoMexeNoCodigoDeOutraTurma() throws Exception {
        Turma outra = novaTurma();
        String codigoDaOutra = outra.getCodigoConvite();

        trocarCodigo(lider);

        assertThat(turmas.findById(outra.getId())).get()
                .extracting("codigoConvite").isEqualTo(codigoDaOutra);
    }
}
