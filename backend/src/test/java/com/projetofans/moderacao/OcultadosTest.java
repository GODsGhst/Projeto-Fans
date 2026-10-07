package com.projetofans.moderacao;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Nota;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.NotaRepository;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /moderacao/ocultados — onde o lider acha de volta o que escondeu.
 *
 * Ocultar tira o registro da vista do proprio lider, e sem esta lista o
 * `reexibir` so servia a quem ainda estava na tela logo apos ocultar. Os testes
 * seguram o desenho dos dois lados do vazamento: o aluno nao pode ver a lista
 * (403), e a lista de uma turma nao pode conter nada de outra.
 */
class OcultadosTest extends TesteDeApi {

    @Autowired private NotaRepository notas;
    @Autowired private EntityManager em;

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

    private Evento evento(Turma daTurma, Materia daMateria, Usuario dono, String titulo) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), daTurma.getId(), daMateria.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(4), null,
                dono.getId(), Instant.now()));
    }

    private Material material(Usuario dono, String titulo) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoMaterial.AULA, titulo, "https://ex.dev/" + titulo, dono.getId(), Instant.now()));
    }

    private Nota nota(Usuario dono, AlcanceNota alcance, String texto) {
        return notas.saveAndFlush(new Nota(UUID.randomUUID(), turma.getId(), dono.getId(),
                alcance, LocalDate.now(), texto, Instant.now()));
    }

    private void ocultar(Usuario quem, String tipo, UUID id) throws Exception {
        http.perform(post("/api/v1/moderacao/" + tipo + "/" + id + "/ocultar")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    private JsonNode ocultados(Usuario quem) throws Exception {
        return json.readTree(http.perform(get("/api/v1/moderacao/ocultados")
                        .header("Authorization", bearer(quem)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private List<String> titulos(JsonNode lista) {
        List<String> saida = new ArrayList<>();
        lista.forEach(o -> saida.add(o.get("titulo").asText()));
        return saida;
    }

    @Test
    @DisplayName("lider ve evento, material e anotacao que ocultou, com tipo, titulo e quem postou")
    void liderVeOQueOcultou() throws Exception {
        Evento prova = evento(turma, materia, ana, "Prova de Calculo");
        Material apostila = material(bruno, "Apostila");
        Nota recado = nota(ana, AlcanceNota.TURMA, "Gente, a prova mudou de sala");
        ocultar(lider, "evento", prova.getId());
        ocultar(lider, "material", apostila.getId());
        ocultar(lider, "nota", recado.getId());

        JsonNode lista = ocultados(lider);

        assertThat(lista).hasSize(3);
        assertThat(titulos(lista)).containsExactlyInAnyOrder(
                "Prova de Calculo", "Apostila", "Gente, a prova mudou de sala");
        for (JsonNode o : lista) {
            switch (o.get("registroTipo").asText()) {
                case "EVENTO" -> {
                    assertThat(o.get("registroId").asText()).isEqualTo(prova.getId().toString());
                    assertThat(o.get("autorNome").asText()).isEqualTo("Ana");
                    assertThat(o.get("autorId").asText()).isEqualTo(ana.getId().toString());
                }
                case "MATERIAL" -> {
                    assertThat(o.get("registroId").asText()).isEqualTo(apostila.getId().toString());
                    assertThat(o.get("autorNome").asText()).isEqualTo("Bruno");
                }
                case "NOTA" -> {
                    assertThat(o.get("registroId").asText()).isEqualTo(recado.getId().toString());
                    assertThat(o.get("autorNome").asText()).isEqualTo("Ana");
                }
                default -> throw new AssertionError("tipo inesperado: " + o);
            }
        }
    }

    @Test
    @DisplayName("diz QUANDO foi ocultado quando ha registro da acao")
    void dizQuandoFoiOcultado() throws Exception {
        Evento prova = evento(turma, materia, ana, "P1");
        ocultar(lider, "evento", prova.getId());
        // `em` e preenchido pelo DEFAULT do banco e a entidade nao o relê na mesma
        // transacao — em producao cada request e uma transacao, aqui nao.
        em.flush();
        em.clear();

        JsonNode o = ocultados(lider).get(0);

        assertThat(o.has("ocultadoEm")).isTrue();
        assertThat(Instant.parse(o.get("ocultadoEm").asText()))
                .isBetween(Instant.now().minusSeconds(60), Instant.now().plusSeconds(60));
    }

    @Test
    @DisplayName("sem registro da acao, o item aparece sem data e nao quebra a lista")
    void semRegistroDaAcaoApareceSemData() throws Exception {
        // Escondido por fora do fluxo normal (sem linha em acao_moderacao).
        Evento prova = evento(turma, materia, ana, "P1");
        prova.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(prova);

        JsonNode lista = ocultados(lider);

        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).has("ocultadoEm")).isFalse();
    }

    @Test
    @DisplayName("reexibir tira o item da lista")
    void reexibirTiraDaLista() throws Exception {
        Evento prova = evento(turma, materia, ana, "P1");
        ocultar(lider, "evento", prova.getId());
        assertThat(ocultados(lider)).hasSize(1);

        http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/reexibir")
                        .header("Authorization", bearer(lider)))
                .andExpect(status().isOk());

        assertThat(ocultados(lider)).isEmpty();
    }

    @Test
    @DisplayName("o que NAO esta oculto nao aparece")
    void visivelNaoAparece() throws Exception {
        evento(turma, materia, ana, "Visivel");
        material(bruno, "Tambem visivel");
        nota(ana, AlcanceNota.TURMA, "recado normal");

        assertThat(ocultados(lider)).isEmpty();
    }

    @Test
    @DisplayName("o que o autor excluiu nao aparece: nao ha o que reexibir")
    void excluidoNaoAparece() throws Exception {
        Evento prova = evento(turma, materia, ana, "P1");
        ocultar(lider, "evento", prova.getId());
        prova.excluirLogicamente(Instant.now());
        eventos.saveAndFlush(prova);

        assertThat(ocultados(lider)).isEmpty();
    }

    @Test
    @DisplayName("anotacao oculta que o autor virou PESSOAL some da lista: rascunho nao sai do autor")
    void notaQueViraPessoalNaoVaza() throws Exception {
        Nota recado = nota(ana, AlcanceNota.TURMA, "recado");
        ocultar(lider, "nota", recado.getId());
        assertThat(ocultados(lider)).hasSize(1);

        // Ana muda de ideia e faz dela um rascunho. A linha segue com
        // visivel_turma = false, e o lider nao pode passar a ler o rascunho dela.
        recado.editar(AlcanceNota.PESSOAL, recado.getData(), "agora e pessoal", Instant.now());
        notas.saveAndFlush(recado);

        assertThat(ocultados(lider)).isEmpty();
    }

    @Test
    @DisplayName("aluno recebe 403 e nao ve a lista")
    void alunoRecebe403() throws Exception {
        Evento prova = evento(turma, materia, ana, "P1");
        ocultar(lider, "evento", prova.getId());

        http.perform(get("/api/v1/moderacao/ocultados").header("Authorization", bearer(bruno)))
                .andExpect(status().isForbidden());
        // Nem o autor do registro oculto — ele ve o dele em "nao listados".
        http.perform(get("/api/v1/moderacao/ocultados").header("Authorization", bearer(ana)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("quem nao tem turma leva 404")
    void semTurmaLeva404() throws Exception {
        http.perform(get("/api/v1/moderacao/ocultados")
                        .header("Authorization", bearer(novoUsuario("Solto"))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("o lider de OUTRA turma nao ve nada daqui, e o daqui nao ve nada de la")
    void outraTurmaNaoVaza() throws Exception {
        Turma outra = novaTurma();
        Materia fisica = novaMateria(outra);
        Usuario liderDeLa = membroDe(outra, "Otto", PapelMembro.LIDER);
        Usuario alunoDeLa = membroDe(outra, "Caio", PapelMembro.ALUNO);

        Evento daqui = evento(turma, materia, ana, "Daqui");
        ocultar(lider, "evento", daqui.getId());
        Evento dela = evento(outra, fisica, alunoDeLa, "Dela");
        ocultar(liderDeLa, "evento", dela.getId());

        assertThat(titulos(ocultados(lider))).containsExactly("Daqui");
        assertThat(titulos(ocultados(liderDeLa))).containsExactly("Dela");
    }

    @Test
    @DisplayName("sem nada oculto a lista vem vazia, nao erro")
    void vaziaNaoQuebra() throws Exception {
        assertThat(ocultados(lider)).isEmpty();
    }

    @Test
    @DisplayName("titulo de anotacao longa e cortado numa linha so")
    void tituloDeNotaLongaECortado() throws Exception {
        Nota recado = nota(ana, AlcanceNota.TURMA, "linha um\nlinha dois " + "x".repeat(200));
        ocultar(lider, "nota", recado.getId());

        String titulo = ocultados(lider).get(0).get("titulo").asText();

        assertThat(titulo).doesNotContain("\n").hasSizeLessThanOrEqualTo(80);
        assertThat(titulo).startsWith("linha um linha dois");
        assertThat(titulo).endsWith("…");
    }
}
