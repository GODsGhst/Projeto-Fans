package com.projetofans.notify;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.DeviceToken;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.DeviceTokenRepository;
import com.projetofans.support.FakeNotifier;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Push e sync: o caminho que faz a notificacao da vespera chegar em aparelho que
 * nao abriu o app no intervalo.
 *
 * Dois testes carregam o desenho inteiro:
 *
 * {@link #notifierNaoRecebeOTokenDoProprioAutor()} — quem cadastrou ja sabe. A
 * regra mora na query do repository, entao o fake resolve os tokens de verdade em
 * vez de so contar chamadas.
 *
 * {@link #syncIncluiEventoOcultoParaQueOAppOReMova()} — o delta e o OPOSTO do
 * resto da API: oculto e excluido PRECISAM aparecer, porque e assim que o
 * aparelho sabe DESAGENDAR. Sem eles o celular avisa as 19h de uma prova que a
 * turma nao ve mais, e o fantasma so some reinstalando.
 */
class NotificacaoTest extends TesteDeApi {

    @Autowired private FakeNotifier notifier;
    @Autowired private DeviceTokenRepository deviceTokens;

    private Turma turma;
    private Materia materia;
    private Usuario autor;
    private Usuario colega;
    private Usuario lider;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        autor = membroDe(turma, "Ana", PapelMembro.ALUNO);
        colega = membroDe(turma, "Bruno", PapelMembro.ALUNO);
        notifier.limpar();
    }

    private Map<String, Object> pedidoDeEvento(String titulo) {
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("materiaId", materia.getId().toString());
        pedido.put("tipo", "PROVA");
        pedido.put("titulo", titulo);
        pedido.put("data", LocalDate.now().plusDays(3).toString());
        pedido.put("hora", null);
        return pedido;
    }

    private JsonNode criarEvento(Usuario quem, String titulo) throws Exception {
        String corpo = http.perform(post("/api/v1/eventos")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento(titulo))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo);
    }

    /** Direto no repository, para poder datar `atualizado_em` no passado. */
    private Evento eventoAntigo(String titulo, long horasAtras) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.PROVA, titulo, LocalDate.now().plusDays(5), null,
                autor.getId(), Instant.now().minus(horasAtras, ChronoUnit.HOURS)));
    }

    private void registrarDevice(Usuario quem, String token) throws Exception {
        http.perform(post("/api/v1/devices")
                        .header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fcmToken\":\"" + token + "\",\"plataforma\":\"android\"}"))
                .andExpect(status().isNoContent());
    }

    private JsonNode sync(Usuario quem, Instant desde) throws Exception {
        String corpo = http.perform(get("/api/v1/sync")
                        .param("desde", desde.toString())
                        .header("Authorization", bearer(quem)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(corpo);
    }

    private JsonNode eventoNoDelta(JsonNode delta, UUID id) {
        for (JsonNode evento : delta.get("eventosAlterados")) {
            if (evento.get("id").asText().equals(id.toString())) {
                return evento;
            }
        }
        return null;
    }

    @Test
    @DisplayName("criar evento chama o Notifier exatamente uma vez (R20)")
    void criarEventoChamaNotifierUmaVez() throws Exception {
        criarEvento(autor, "P1");

        assertThat(notifier.chamadas()).hasSize(1);
        FakeNotifier.Chamada unica = notifier.chamadas().get(0);
        assertThat(unica.turmaId()).isEqualTo(turma.getId());
        assertThat(unica.autorExcluido()).isEqualTo(autor.getId());
        assertThat(unica.payload().tipo()).isEqualTo("sync");
        assertThat(unica.payload().desde()).isNotNull();
    }

    @Test
    @DisplayName("o aparelho de quem cadastrou nao recebe push do proprio cadastro")
    void notifierNaoRecebeOTokenDoProprioAutor() throws Exception {
        registrarDevice(autor, "tok-da-ana");
        registrarDevice(colega, "tok-do-bruno");
        notifier.limpar();

        criarEvento(autor, "P1");

        assertThat(notifier.chamadas()).hasSize(1);
        assertThat(notifier.chamadas().get(0).tokens())
                .containsExactly("tok-do-bruno")
                .doesNotContain("tok-da-ana");
    }

    @Test
    @DisplayName("editar evento chama o Notifier")
    void editarEventoChamaNotifier() throws Exception {
        JsonNode criado = criarEvento(autor, "P1");
        notifier.limpar();

        http.perform(patch("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearer(autor))
                        .header("If-Match", criado.get("version").asInt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pedidoDeEvento("P1 adiada"))))
                .andExpect(status().isOk());

        assertThat(notifier.chamadas()).hasSize(1);
        assertThat(notifier.chamadas().get(0).autorExcluido()).isEqualTo(autor.getId());
    }

    @Test
    @DisplayName("excluir evento chama o Notifier — o aparelho precisa desagendar")
    void excluirEventoChamaNotifier() throws Exception {
        JsonNode criado = criarEvento(autor, "P1");
        notifier.limpar();

        http.perform(delete("/api/v1/eventos/" + criado.get("id").asText())
                        .header("Authorization", bearer(autor))
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        assertThat(notifier.chamadas()).hasSize(1);
    }

    @Test
    @DisplayName("sync entrega lapide, nao conteudo, de evento excluido para quem nao e o autor")
    void syncNaoVazaConteudoDeEventoExcluidoParaNaoAutor() throws Exception {
        // O furo que este teste fecha: o /sync devolvia titulo, data, materia e
        // autoria de TODO registro moderado para qualquer membro da turma. Isso
        // reabria por outra rota o que EventoService.buscar recusa com 404 — e sem
        // nem precisar saber o id, bastava pedir o delta desde 1970.
        JsonNode criado = criarEvento(autor, "Prova secreta");
        UUID id = UUID.fromString(criado.get("id").asText());

        http.perform(delete("/api/v1/eventos/" + id)
                        .header("Authorization", bearer(autor))
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        JsonNode paraColega = eventoNoDelta(sync(colega, Instant.now().minusSeconds(3600)), id);

        // O item CONTINUA no delta: sem ele o aparelho nunca desagenda o aviso.
        assertThat(paraColega)
                .as("filtrar o item para fora deixaria notificacao fantasma no aparelho")
                .isNotNull();
        assertThat(paraColega.has("excluidoEm")).isTrue();

        // O conteudo nao viaja. `has` e nao `isNull` porque o projeto serializa com
        // default-property-inclusion: non_null — campo nulo nao vira `null` no JSON,
        // ele desaparece. Melhor ainda: nem o nome do campo vaza.
        assertThat(paraColega.has("titulo")).as("titulo nao pode viajar").isFalse();
        assertThat(paraColega.has("data")).as("data nao pode viajar").isFalse();
        assertThat(paraColega.has("materiaSigla")).as("materia nao pode viajar").isFalse();
        assertThat(paraColega.has("autoria")).as("autoria nao pode viajar").isFalse();
    }

    @Test
    @DisplayName("o autor continua vendo o conteudo do proprio evento excluido no sync")
    void syncEntregaConteudoDoProprioEventoExcluidoParaOAutor() throws Exception {
        // Contrapeso do teste acima: a lapide nao pode virar cega para todo mundo.
        // "Visivel apenas para o autor" tem as duas metades.
        JsonNode criado = criarEvento(autor, "Prova secreta");
        UUID id = UUID.fromString(criado.get("id").asText());

        http.perform(delete("/api/v1/eventos/" + id)
                        .header("Authorization", bearer(autor))
                        .header("If-Match", criado.get("version").asInt()))
                .andExpect(status().isNoContent());

        JsonNode paraAutor = eventoNoDelta(sync(autor, Instant.now().minusSeconds(3600)), id);

        assertThat(paraAutor).isNotNull();
        assertThat(paraAutor.get("titulo").asText()).isEqualTo("Prova secreta");
        assertThat(paraAutor.get("autoria").get("autorNome").asText()).isEqualTo("Ana");
    }

    @Test
    @DisplayName("evento visivel continua vindo inteiro no sync")
    void syncEntregaConteudoDeEventoVisivel() throws Exception {
        // A lapide so vale para oculto e excluido. Se ela vazasse para o caminho
        // normal, o app pararia de receber os dados que usa para agendar.
        JsonNode criado = criarEvento(autor, "Prova normal");
        UUID id = UUID.fromString(criado.get("id").asText());

        JsonNode paraColega = eventoNoDelta(sync(colega, Instant.now().minusSeconds(3600)), id);

        assertThat(paraColega).isNotNull();
        assertThat(paraColega.get("titulo").asText()).isEqualTo("Prova normal");
        assertThat(paraColega.get("materiaSigla").isNull()).isFalse();
    }

    @Test
    @DisplayName("registrar token de device que ja e de outra pessoa responde 409")
    void naoDaParaTomarTokenDeOutroUsuario() throws Exception {
        // O furo que este teste fecha: registrar fazia upsert por fcm_token e
        // regravava o dono sem checar. Um POST com o token da vitima transferia a
        // linha, e ela parava de receber os avisos da propria turma — exatamente o
        // poder que o metodo remover() documenta que nao pode existir.
        String token = "token-do-bruno-" + UUID.randomUUID();
        registrarDevice(colega, token);

        http.perform(post("/api/v1/devices")
                        .header("Authorization", bearer(autor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fcmToken\":\"" + token + "\",\"plataforma\":\"android\"}"))
                .andExpect(status().isConflict());

        assertThat(deviceTokens.findByFcmToken(token).orElseThrow().getUsuarioId())
                .as("o token tem de continuar com o dono original")
                .isEqualTo(colega.getId());
    }

    @Test
    @DisplayName("o proprio dono pode registrar o mesmo token de novo — renova, nao conflita")
    void donoRenovaOProprioToken() throws Exception {
        // Contrapeso: o app manda POST /devices a cada abertura. Se a guarda
        // pegasse o proprio dono, o push pararia de funcionar no segundo login.
        String token = "token-da-ana-" + UUID.randomUUID();
        registrarDevice(autor, token);
        registrarDevice(autor, token);

        assertThat(deviceTokens.findByFcmToken(token).orElseThrow().getUsuarioId())
                .isEqualTo(autor.getId());
    }

    @Test
    @DisplayName("sync devolve so os eventos alterados depois do timestamp")
    void syncDevolveEventosAlteradosDepoisDoTimestamp() throws Exception {
        Evento antigo = eventoAntigo("P antiga", 2);
        Instant desde = Instant.now().minus(1, ChronoUnit.HOURS);
        JsonNode novo = criarEvento(autor, "P nova");

        JsonNode delta = sync(colega, desde);

        assertThat(eventoNoDelta(delta, UUID.fromString(novo.get("id").asText()))).isNotNull();
        assertThat(eventoNoDelta(delta, antigo.getId())).isNull();
        assertThat(delta.get("servidorEm").asText()).isNotBlank();
        assertThat(delta.get("materias")).hasSize(1);
    }

    @Test
    @DisplayName("sync inclui o evento oculto pelo lider, senao a notificacao vira fantasma")
    void syncIncluiEventoOcultoParaQueOAppOReMova() throws Exception {
        // Datado no passado de proposito: ocultar NAO toca em atualizado_em ("ocultar
        // nao e edicao de conteudo"), entao so o rastro em acao_moderacao delata a
        // mudanca. Se o delta olhasse apenas atualizado_em, este evento sumiria da
        // Home de todo mundo e o celular avisaria as 19h assim mesmo.
        Evento prova = eventoAntigo("P que sumiu", 2);
        Instant desde = Instant.now().minus(1, ChronoUnit.HOURS);

        http.perform(post("/api/v1/moderacao/evento/" + prova.getId() + "/ocultar")
                        .header("Authorization", bearer(lider))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"duplicado\"}"))
                .andExpect(status().isOk());

        JsonNode noDelta = eventoNoDelta(sync(colega, desde), prova.getId());

        assertThat(noDelta).isNotNull();
        assertThat(noDelta.get("visivelTurma").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("registrar o mesmo device token duas vezes atualiza, nao duplica")
    void registrarDeviceTokenDuasVezesNaoDuplica() throws Exception {
        registrarDevice(colega, "tok-do-bruno");
        registrarDevice(colega, "tok-do-bruno");

        assertThat(deviceTokens.findAll()).hasSize(1);
        assertThat(deviceTokens.findByFcmToken("tok-do-bruno"))
                .get().extracting(DeviceToken::getUsuarioId).isEqualTo(colega.getId());
    }
}
