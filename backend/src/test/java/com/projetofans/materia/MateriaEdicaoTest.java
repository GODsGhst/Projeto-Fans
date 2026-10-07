package com.projetofans.materia;

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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Corrigir e apagar materia.
 *
 * `materia` nao guarda quem a criou, entao por enquanto so o LIDER faz as duas
 * coisas — o lado "quem criou" da regra espera a coluna `autor_id` (migration).
 * Por isso os testes de poder cobrem lider e aluno, e nao autor.
 *
 * Apagar so vale para materia vazia, e vazia inclui o que o app nao mostra mais:
 * evento oculto e evento excluido logicamente ainda sao linhas apontando para a
 * materia, e a FK do banco as conta.
 */
class MateriaEdicaoTest extends TesteDeApi {

    private Turma turma;
    private Usuario lider;
    private Usuario aluno;
    private Materia calculo;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        aluno = membroDe(turma, "Ana", PapelMembro.ALUNO);
        calculo = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Calculo", "CAL", "#1D4ED8"));
    }

    private Map<String, Object> corpo(String nome, String sigla, String cor,
                                      String sala, String professor) {
        Map<String, Object> p = new HashMap<>();
        p.put("nome", nome);
        p.put("sigla", sigla);
        p.put("corHex", cor);
        p.put("sala", sala);
        p.put("professor", professor);
        return p;
    }

    private MvcResult editar(Usuario quem, UUID id, Map<String, Object> pedido) throws Exception {
        return http.perform(patch("/api/v1/materias/" + id)
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(pedido)))
                .andReturn();
    }

    private int apagar(Usuario quem, UUID id) throws Exception {
        return http.perform(delete("/api/v1/materias/" + id)
                        .header("Authorization", bearer(quem)))
                .andReturn().getResponse().getStatus();
    }

    private Evento eventoNa(Materia materia, Usuario dono) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, "P1", LocalDate.now().plusDays(5), null,
                dono.getId(), Instant.now()));
    }

    private Material materialNa(Materia materia, Usuario dono) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoMaterial.AULA, "Apostila", "https://ex.dev/a", dono.getId(), Instant.now()));
    }

    // ------------------------------------------------------------------ editar

    @Test
    @DisplayName("lider corrige sigla, nome, cor, sala e professor")
    void liderCorrigeTudo() throws Exception {
        MvcResult r = editar(lider, calculo.getId(),
                corpo("Calculo II", "CAL2", "#b91c1c", "B-204", "prof. Marcos"));

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        JsonNode corpo = json.readTree(r.getResponse().getContentAsString());
        assertThat(corpo.get("id").asText()).isEqualTo(calculo.getId().toString());
        assertThat(corpo.get("nome").asText()).isEqualTo("Calculo II");
        assertThat(corpo.get("sigla").asText()).isEqualTo("CAL2");
        assertThat(corpo.get("corHex").asText()).isEqualTo("#B91C1C");
        assertThat(corpo.get("sala").asText()).isEqualTo("B-204");
        assertThat(corpo.get("professor").asText()).isEqualTo("prof. Marcos");

        Materia salva = materias.findById(calculo.getId()).orElseThrow();
        assertThat(salva.getSigla()).isEqualTo("CAL2");
        assertThat(salva.getTurmaId()).as("a materia nao muda de turma").isEqualTo(turma.getId());
    }

    @Test
    @DisplayName("sala e professor em branco viram 'nao informado'")
    void emBrancoLimpaSalaEProfessor() throws Exception {
        editar(lider, calculo.getId(), corpo("Calculo", "CAL", "#1D4ED8", "B-204", "Marcos"));

        editar(lider, calculo.getId(), corpo("Calculo", "CAL", "#1D4ED8", "  ", null));

        Materia salva = materias.findById(calculo.getId()).orElseThrow();
        assertThat(salva.getSala()).isNull();
        assertThat(salva.getProfessor()).isNull();
    }

    @Test
    @DisplayName("aluno nao corrige: 403 e a materia fica como estava")
    void alunoNaoCorrige() throws Exception {
        MvcResult r = editar(aluno, calculo.getId(),
                corpo("Hackeada", "HACK", "#1D4ED8", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        Materia salva = materias.findById(calculo.getId()).orElseThrow();
        assertThat(salva.getNome()).isEqualTo("Calculo");
        assertThat(salva.getSigla()).isEqualTo("CAL");
    }

    @Test
    @DisplayName("materia de outra turma: 404 para o lider e para o aluno daqui, nunca 403")
    void outraTurmaLeva404() throws Exception {
        Turma outra = novaTurma();
        Materia alheia = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), outra.getId(), "Fisica", "FIS", "#0369A1"));

        // Escopo antes de poder: se o 403 viesse primeiro, o aluno daqui
        // descobriria que a materia de la existe.
        assertThat(editar(lider, alheia.getId(), corpo("X", "X", "#1D4ED8", null, null))
                .getResponse().getStatus()).isEqualTo(404);
        assertThat(editar(aluno, alheia.getId(), corpo("X", "X", "#1D4ED8", null, null))
                .getResponse().getStatus()).isEqualTo(404);
        assertThat(materias.findById(alheia.getId()).orElseThrow().getNome()).isEqualTo("Fisica");
    }

    @Test
    @DisplayName("sigla de outra materia da turma: 409 com mensagem clara")
    void siglaRepetidaLeva409() throws Exception {
        materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Redes", "REDES", "#15803D"));

        MvcResult r = editar(lider, calculo.getId(),
                corpo("Calculo", "REDES", "#1D4ED8", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(409);
        assertThat(json.readTree(r.getResponse().getContentAsString()).get("detail").asText())
                .contains("REDES").contains("sigla");
        assertThat(materias.findById(calculo.getId()).orElseThrow().getSigla()).isEqualTo("CAL");
    }

    @Test
    @DisplayName("salvar mantendo a PROPRIA sigla nao da 409 contra si mesmo")
    void propriaSiglaNaoConflita() throws Exception {
        MvcResult r = editar(lider, calculo.getId(),
                corpo("Calculo Diferencial", "CAL", "#1D4ED8", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("a mesma sigla em OUTRA turma nao conflita")
    void siglaIgualEmOutraTurmaNaoConflita() throws Exception {
        Turma outra = novaTurma();
        materias.saveAndFlush(new Materia(
                UUID.randomUUID(), outra.getId(), "Redes", "REDES", "#15803D"));

        MvcResult r = editar(lider, calculo.getId(),
                corpo("Calculo", "REDES", "#1D4ED8", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("cor fora da paleta: 400, e a materia fica como estava")
    void corForaDaPaletaLeva400() throws Exception {
        MvcResult r = editar(lider, calculo.getId(),
                corpo("Calculo", "CAL", "#FFFF00", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(materias.findById(calculo.getId()).orElseThrow().getCorHex())
                .isEqualTo("#1D4ED8");
    }

    @Test
    @DisplayName("nome em branco: 400")
    void nomeEmBrancoLeva400() throws Exception {
        MvcResult r = editar(lider, calculo.getId(), corpo(" ", "CAL", "#1D4ED8", null, null));

        assertThat(r.getResponse().getStatus()).isEqualTo(400);
    }

    // ------------------------------------------------------------------- apagar

    @Test
    @DisplayName("lider apaga materia vazia: 204 e ela some")
    void liderApagaMateriaVazia() throws Exception {
        assertThat(apagar(lider, calculo.getId())).isEqualTo(204);

        assertThat(materias.findById(calculo.getId())).isEmpty();
        http.perform(get("/api/v1/materias/" + calculo.getId())
                        .header("Authorization", bearer(lider)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("materia com prova: 409 'Mova ou apague as provas e materiais antes'")
    void comEventoLeva409() throws Exception {
        eventoNa(calculo, aluno);

        MvcResult r = http.perform(delete("/api/v1/materias/" + calculo.getId())
                .header("Authorization", bearer(lider))).andReturn();

        assertThat(r.getResponse().getStatus()).isEqualTo(409);
        assertThat(json.readTree(r.getResponse().getContentAsString()).get("detail").asText())
                .isEqualTo("Mova ou apague as provas e materiais antes");
        assertThat(materias.findById(calculo.getId())).isPresent();
    }

    @Test
    @DisplayName("materia com material: 409")
    void comMaterialLeva409() throws Exception {
        materialNa(calculo, aluno);

        assertThat(apagar(lider, calculo.getId())).isEqualTo(409);
        assertThat(materias.findById(calculo.getId())).isPresent();
    }

    @Test
    @DisplayName("evento OCULTO ainda conta como conteudo: 409")
    void eventoOcultoConta() throws Exception {
        Evento e = eventoNa(calculo, aluno);
        e.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(e);

        assertThat(apagar(lider, calculo.getId())).isEqualTo(409);
    }

    @Test
    @DisplayName("evento EXCLUIDO logicamente ainda conta: a linha existe e a FK a enxerga")
    void eventoExcluidoConta() throws Exception {
        Evento e = eventoNa(calculo, aluno);
        e.excluirLogicamente(Instant.now());
        eventos.saveAndFlush(e);

        assertThat(apagar(lider, calculo.getId())).isEqualTo(409);
        assertThat(materias.findById(calculo.getId())).isPresent();
    }

    @Test
    @DisplayName("material OCULTO e material EXCLUIDO tambem contam")
    void materialOcultoEExcluidoContam() throws Exception {
        Material oculto = materialNa(calculo, aluno);
        oculto.definirVisibilidadeTurma(false);
        materiais.saveAndFlush(oculto);
        assertThat(apagar(lider, calculo.getId())).isEqualTo(409);

        materiais.delete(oculto);
        Material excluido = materialNa(calculo, aluno);
        excluido.excluirLogicamente(Instant.now());
        materiais.saveAndFlush(excluido);
        assertThat(apagar(lider, calculo.getId())).isEqualTo(409);
    }

    @Test
    @DisplayName("conteudo de OUTRA materia nao impede apagar esta")
    void conteudoDeOutraMateriaNaoImpede() throws Exception {
        Materia redes = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Redes", "REDES", "#15803D"));
        eventoNa(redes, aluno);

        assertThat(apagar(lider, calculo.getId())).isEqualTo(204);
        assertThat(materias.findById(redes.getId())).isPresent();
    }

    @Test
    @DisplayName("aluno nao apaga: 403 e a materia continua")
    void alunoNaoApaga() throws Exception {
        assertThat(apagar(aluno, calculo.getId())).isEqualTo(403);
        assertThat(materias.findById(calculo.getId())).isPresent();
    }

    @Test
    @DisplayName("apagar materia de outra turma: 404 para o lider e o aluno daqui, nunca 403")
    void apagarDeOutraTurmaLeva404() throws Exception {
        Turma outra = novaTurma();
        Materia alheia = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), outra.getId(), "Fisica", "FIS", "#0369A1"));

        assertThat(apagar(lider, alheia.getId())).isEqualTo(404);
        assertThat(apagar(aluno, alheia.getId())).isEqualTo(404);
        assertThat(materias.findById(alheia.getId())).isPresent();
    }
}
