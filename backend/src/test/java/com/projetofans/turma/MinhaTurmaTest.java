package com.projetofans.turma;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/v1/turmas/minha — quem esta na turma, quem e o lider, e qual e o codigo.
 *
 * Nenhuma tarefa do plano criou isto. O codigo de convite so aparecia no instante
 * em que a turma era criada: quem fechava o app naquela tela nunca mais o via, e
 * turma sem codigo divulgavel nao recebe ninguem.
 */
@Transactional
class MinhaTurmaTest extends TesteDeApi {

    private Turma turma;
    private Usuario lider;
    private Usuario aluno;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        lider = membroDe(turma, "Otavio", PapelMembro.LIDER);
        aluno = membroDe(turma, "Ana", PapelMembro.ALUNO);
    }

    private JsonNode minha(Usuario quem) throws Exception {
        MvcResult r = http.perform(get("/api/v1/turmas/minha").header("Authorization", bearer(quem)))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    private List<String> nomes(JsonNode corpo) {
        List<String> saida = new ArrayList<>();
        corpo.get("membros").forEach(m -> saida.add(m.get("nome").asText()));
        return saida;
    }

    @Test
    @DisplayName("membro da turma ve a turma, os membros e o codigo de convite")
    void membroVeTurmaMembrosECodigo() throws Exception {
        JsonNode corpo = minha(lider);

        assertThat(corpo.get("id").asText()).isEqualTo(turma.getId().toString());
        assertThat(corpo.get("nome").asText()).isEqualTo(turma.getNome());
        assertThat(corpo.get("semestre").asText()).isEqualTo(turma.getSemestre());
        assertThat(corpo.get("codigoConvite").asText()).isEqualTo(turma.getCodigoConvite());
        assertThat(nomes(corpo)).containsExactlyInAnyOrder("Otavio", "Ana");

        JsonNode membro = corpo.get("membros").get(0);
        // Entidade JPA nunca cruza o controller: o membro sai com o NOME resolvido,
        // nao com o usuario_id sozinho nem com a entidade inteira.
        assertThat(membro.has("usuarioId")).isTrue();
        assertThat(membro.has("entrouEm")).isTrue();
        assertThat(membro.get("entrouEm").isNull()).isFalse();
        assertThat(membro.has("senhaHash")).isFalse();
        assertThat(membro.has("email")).isFalse();
    }

    @Test
    @DisplayName("quem nao e membro leva 404, nunca 403")
    void quemNaoEMembroLeva404() throws Exception {
        // 403 confirmaria que a turma existe — e o codigo de convite e exatamente
        // o que nao pode vazar para quem esta de fora.
        Usuario forasteiro = novoUsuario("Forasteiro");

        http.perform(get("/api/v1/turmas/minha").header("Authorization", bearer(forasteiro)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("membro de outra turma nao ve esta turma nem o codigo dela")
    void membroDeOutraTurmaNaoVeEsta() throws Exception {
        Turma outra = novaTurma();
        Usuario deOutra = membroDe(outra, "Bruno", PapelMembro.LIDER);

        JsonNode corpo = minha(deOutra);

        assertThat(corpo.get("id").asText()).isEqualTo(outra.getId().toString());
        assertThat(corpo.get("codigoConvite").asText()).isNotEqualTo(turma.getCodigoConvite());
        assertThat(nomes(corpo)).containsExactly("Bruno");
    }

    @Test
    @DisplayName("o lider aparece marcado como LIDER e os outros como ALUNO")
    void papelDeCadaMembroAparece() throws Exception {
        JsonNode corpo = minha(aluno);

        for (JsonNode m : corpo.get("membros")) {
            String esperado = m.get("usuarioId").asText().equals(lider.getId().toString())
                    ? "LIDER" : "ALUNO";
            assertThat(m.get("papel").asText()).isEqualTo(esperado);
        }
    }

    @Test
    @DisplayName("aluno comum tambem ve o codigo de convite — qualquer membro convida")
    void alunoComumVeCodigoDeConvite() throws Exception {
        // Nao-negociavel 9: qualquer membro posta e qualquer membro convida. Esconder
        // o codigo do aluno faria a entrada depender do lider estar por perto.
        JsonNode corpo = minha(aluno);

        assertThat(corpo.get("codigoConvite").asText()).isEqualTo(turma.getCodigoConvite());
    }

    @Test
    @DisplayName("a ordem dos membros e estavel entre duas chamadas")
    void ordemDosMembrosEEstavel() throws Exception {
        // Lista que muda de ordem a cada abertura parece que mudou de conteudo.
        membroDe(turma, "Bruno", PapelMembro.ALUNO);
        membroDe(turma, "Carla", PapelMembro.ALUNO);

        assertThat(nomes(minha(aluno))).isEqualTo(nomes(minha(aluno)));
    }

    @Test
    @DisplayName("o lider renomeia a turma e acerta o periodo — o codigo NAO muda")
    void liderRenomeiaSemTrocarOCodigo() throws Exception {
        // O periodo envelhece sozinho: no setimo periodo a turma ainda se
        // chamava "Fans 2026.2" e nao havia como corrigir. Dado que envelhece e
        // nao pode ser atualizado e pior que dado ausente, porque parece atual.
        String codigoAntes = turma.getCodigoConvite();

        MvcResult r = http.perform(patch("/api/v1/turmas/minha")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Fans\",\"semestre\":\"2027.1\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode depois = json.readTree(r.getResponse().getContentAsString());

        assertThat(depois.get("nome").asText()).isEqualTo("Fans");
        assertThat(depois.get("semestre").asText()).isEqualTo("2027.1");
        assertThat(depois.get("codigoConvite").asText())
                .as("o codigo esta anotado no celular de todo mundo — troca-lo expulsaria a turma")
                .isEqualTo(codigoAntes);
    }

    @Test
    @DisplayName("aluno NAO renomeia a turma")
    void alunoNaoRenomeia() throws Exception {
        http.perform(patch("/api/v1/turmas/minha")
                        .header("Authorization", bearer(aluno))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Outra coisa\",\"semestre\":\"2027.1\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("semestre em branco vira nulo — turma sem periodo continua valida")
    void semestreEmBrancoViraNulo() throws Exception {
        // Quem nao sabe o periodo nao deve inventar um. E o campo agora pode ser
        // esvaziado: turma que mudou de periodo e ainda nao sabe o novo fica sem,
        // em vez de ficar com o antigo mentindo.
        MvcResult r = http.perform(patch("/api/v1/turmas/minha")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Fans\",\"semestre\":\"  \"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode depois = json.readTree(r.getResponse().getContentAsString());

        assertThat(depois.get("semestre") == null || depois.get("semestre").isNull())
                .as("espaco em branco nao e um periodo")
                .isTrue();
    }
}
