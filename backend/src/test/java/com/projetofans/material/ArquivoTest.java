package com.projetofans.material;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.service.ArquivoService;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Envio de arquivo (multipart/form-data) para uma prova ou entrega, e download
 * do que foi enviado. O contrato e o da apostila de upload: campo `arquivo`,
 * campo opcional `descricao`, 201 com o registro criado.
 */
class ArquivoTest extends TesteDeApi {

    private static final byte[] PDF = "%PDF-1.4\nconteudo de teste\n%%EOF".getBytes(StandardCharsets.US_ASCII);

    private Turma turma;
    private Evento prova;
    private String bearerAluno;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        Materia materia = novaMateria(turma);
        Usuario aluno = membroDe(turma, "Aluna", PapelMembro.ALUNO);
        bearerAluno = bearer(aluno);
        prova = eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, "P1", LocalDate.now().plusDays(3), null, aluno.getId(), Instant.now()));
    }

    private ResultActions enviar(String bearer, String nome, byte[] conteudo, String descricao)
            throws Exception {
        var pedido = multipart("/api/v1/eventos/{id}/arquivos", prova.getId())
                .file(new MockMultipartFile("arquivo", nome, "application/octet-stream", conteudo));
        if (descricao != null) {
            pedido.param("descricao", descricao);
        }
        if (bearer != null) {
            pedido.header("Authorization", bearer);
        }
        return http.perform(pedido);
    }

    @Test
    @DisplayName("aluno envia PDF: 201, material com autor e arquivo, ja vinculado a prova")
    void enviaEVincula() throws Exception {
        String resposta = enviar(bearerAluno, "lista.pdf", PDF, "Lista 2")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("Lista 2"))
                .andExpect(jsonPath("$.autoria.autorNome").value("Aluna"))
                .andExpect(jsonPath("$.url").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        JsonNode material = json.readTree(resposta);
        assertThat(material.get("arquivoRef").asText()).isNotBlank();

        http.perform(get("/api/v1/eventos/{id}", prova.getId()).header("Authorization", bearerAluno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.materiais[0].id").value(material.get("id").asText()));
    }

    @Test
    @DisplayName("sem descricao, o titulo e o nome do arquivo sem o caminho")
    void tituloPadraoEONome() throws Exception {
        enviar(bearerAluno, "C:\\Users\\aluna\\resumo.pdf", PDF, "  ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("resumo.pdf"));
    }

    @Test
    @DisplayName("quem e da turma baixa os mesmos bytes, com o tipo conferido pelo servidor")
    void baixaOMesmoConteudo() throws Exception {
        String ref = json.readTree(enviar(bearerAluno, "lista.pdf", PDF, null)
                .andReturn().getResponse().getContentAsString()).get("arquivoRef").asText();

        byte[] baixado = http.perform(get("/api/v1/arquivos/{id}", ref).header("Authorization", bearerAluno))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(baixado).isEqualTo(PDF);
    }

    @Test
    @DisplayName("de outra turma: enviar e baixar dao 404, nao 403")
    void outraTurmaE404() throws Exception {
        String ref = json.readTree(enviar(bearerAluno, "lista.pdf", PDF, null)
                .andReturn().getResponse().getContentAsString()).get("arquivoRef").asText();
        String bearerDeFora = bearer(membroDe(novaTurma(), "De fora", PapelMembro.ALUNO));

        enviar(bearerDeFora, "lista.pdf", PDF, null).andExpect(status().isNotFound());
        http.perform(get("/api/v1/arquivos/{id}", ref).header("Authorization", bearerDeFora))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("extensao fora da lista e 415")
    void extensaoForaDaLista() throws Exception {
        enviar(bearerAluno, "programa.exe", PDF, null).andExpect(status().isUnsupportedMediaType());
    }

    @Test
    @DisplayName("extensao que nao bate com o conteudo e 415: o nome nao basta")
    void conteudoNaoBateComAExtensao() throws Exception {
        enviar(bearerAluno, "foto.png", PDF, null).andExpect(status().isUnsupportedMediaType());
    }

    @Test
    @DisplayName("acima de 5 MB e 413")
    void acimaDoTeto() throws Exception {
        byte[] grande = Arrays.copyOf(PDF, ArquivoService.TETO_BYTES + 1);
        enviar(bearerAluno, "grande.pdf", grande, null).andExpect(status().isPayloadTooLarge());
    }

    @Test
    @DisplayName("arquivo vazio e 400")
    void vazio() throws Exception {
        enviar(bearerAluno, "vazio.pdf", new byte[0], null).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("sem token e 401")
    void semToken() throws Exception {
        enviar(null, "lista.pdf", PDF, null).andExpect(status().isUnauthorized());
    }
}
