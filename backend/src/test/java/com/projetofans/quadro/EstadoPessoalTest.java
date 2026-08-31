package com.projetofans.quadro;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.EstadoPessoalRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.EstadoPessoalService;
import com.projetofans.support.TesteDeApi;
import com.projetofans.web.dto.ItemHomeResponse;
import com.projetofans.web.dto.MeuQuadroResponse;
import com.projetofans.web.dto.NaoListadosResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O nao-negociavel 3 vive aqui: fato compartilhado nunca guarda estado pessoal.
 *
 * O teste central do arquivo e marcarFeitoNaoAlteraNenhumaColunaDeEvento. Ele nao
 * confere um campo escolhido a dedo — le a linha inteira de `evento` antes e
 * depois e exige igualdade total, inclusive atualizado_em e version. Se um dia
 * alguem adicionar uma coluna `feito` em `evento` "para simplificar a query da
 * Home", ou fizer o marcar tocar no evento por acidente, este teste fica vermelho
 * sem precisar ser reescrito.
 *
 * R16 e o segundo guardiao: o estado de A nao pode vazar para o quadro de B.
 * R15 fecha "Nao listados" pelos dois lados — o que aparece para o autor, e o que
 * nao aparece para mais ninguem.
 */
class EstadoPessoalTest extends TesteDeApi {

    @Autowired
    private EstadoPessoalService estadoPessoal;

    @Autowired
    private EstadoPessoalRepository estados;

    @Autowired
    private JdbcTemplate jdbc;

    private Turma turma;
    private Materia materia;
    private Usuario a;
    private Usuario b;
    private UsuarioAtual eu;
    private UsuarioAtual outro;

    @BeforeEach
    void cenario() {
        turma = novaTurma();
        materia = novaMateria(turma);
        a = membroDe(turma, "Ana", PapelMembro.ALUNO);
        b = membroDe(turma, "Bruno", PapelMembro.ALUNO);
        eu = new UsuarioAtual(a.getId(), a.getNome());
        outro = new UsuarioAtual(b.getId(), b.getNome());
    }

    private Evento evento(Usuario autor, String titulo, int emDias) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoEvento.ENTREGA, titulo, LocalDate.now().plusDays(emDias), null,
                autor.getId(), Instant.now()));
    }

    private Material material(Usuario autor, String titulo) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), materia.getId(),
                TipoMaterial.AULA, titulo, "https://ex.dev/" + titulo,
                autor.getId(), Instant.now()));
    }

    /** A linha inteira, do jeito que o banco a guarda — nao um DTO filtrado. */
    private Map<String, Object> linhaDeEvento(UUID id) {
        return jdbc.queryForMap("select * from evento where id = ?", id);
    }

    private static List<String> titulos(List<ItemHomeResponse> itens) {
        return itens.stream().map(ItemHomeResponse::titulo).toList();
    }

    /**
     * R3, o teste central. Marcar feito passa pelo endpoint de verdade e a linha de
     * `evento` tem de sair identica: mesmos campos, mesmo atualizado_em, mesma
     * version. Comparar a linha toda em vez de campos escolhidos e o que faz este
     * teste continuar valendo quando a tabela ganhar colunas novas.
     */
    @Test
    @DisplayName("R3 — marcar feito nao altera nenhuma coluna de evento")
    void marcarFeitoNaoAlteraNenhumaColunaDeEvento() throws Exception {
        Evento evento = evento(a, "Relatorio", 3);
        Map<String, Object> antes = linhaDeEvento(evento.getId());

        http.perform(put("/api/v1/eventos/" + evento.getId() + "/estado-pessoal")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"feito\":true}"))
                .andExpect(status().isNoContent());

        assertThat(linhaDeEvento(evento.getId())).isEqualTo(antes);
        assertThat(antes).doesNotContainKey("feito");
        assertThat(estados.findByChaveUsuarioIdAndChaveEventoId(a.getId(), evento.getId()))
                .get()
                .satisfies(estado -> assertThat(estado.isFeito()).isTrue());
    }

    /** R16 — estado pessoal e pessoal. O que Ana marcou nao muda o quadro de Bruno. */
    @Test
    @DisplayName("R16 — o feito de A nao aparece no quadro de B")
    void estadoDeAdoNaoApareceNoQuadroDeB() {
        Evento evento = evento(a, "Lista 4", 2);
        estadoPessoal.marcar(eu, evento.getId(), true);

        MeuQuadroResponse quadroDeB = estadoPessoal.meuQuadro(outro);

        assertThat(titulos(quadroDeB.feito())).isEmpty();
        assertThat(titulos(quadroDeB.aFazer())).containsExactly("Lista 4");
        assertThat(quadroDeB.aFazer().get(0).feitoPeloUsuario()).isFalse();
    }

    /** Tocar duas vezes no mesmo botao nao pode estourar a PK nem duplicar linha. */
    @Test
    @DisplayName("marcar duas vezes e idempotente")
    void marcarDuasVezesEIdempotente() {
        Evento evento = evento(a, "Seminario", 5);

        estadoPessoal.marcar(eu, evento.getId(), true);
        estadoPessoal.marcar(eu, evento.getId(), true);

        assertThat(estados.findByChaveUsuarioId(a.getId())).hasSize(1);
        assertThat(titulos(estadoPessoal.meuQuadro(eu).feito())).containsExactly("Seminario");
    }

    /** As duas colunas do kanban, e o caminho de volta: desmarcar devolve para "a fazer". */
    @Test
    @DisplayName("o quadro separa a fazer de feito")
    void quadroSeparaAFazerDeFeito() {
        evento(a, "Pendente", 1);
        Evento pronto = evento(a, "Pronto", 2);
        estadoPessoal.marcar(eu, pronto.getId(), true);

        MeuQuadroResponse quadro = estadoPessoal.meuQuadro(eu);

        assertThat(titulos(quadro.aFazer())).containsExactly("Pendente");
        assertThat(titulos(quadro.feito())).containsExactly("Pronto");
        assertThat(quadro.feito().get(0).feitoPeloUsuario()).isTrue();

        estadoPessoal.marcar(eu, pronto.getId(), false);
        assertThat(titulos(estadoPessoal.meuQuadro(eu).aFazer()))
                .containsExactlyInAnyOrder("Pendente", "Pronto");
    }

    /** R15 — o autor ve o proprio registro oculto ou excluido. Ninguem mais ve. */
    @Test
    @DisplayName("R15 — nao listados mostra os registros do proprio autor")
    void naoListadosSoMostraRegistrosDoProprioAutor() {
        Evento oculto = evento(a, "Prova adiada", 4);
        oculto.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(oculto);

        Evento excluido = evento(a, "Entrega cancelada", 6);
        excluido.excluirLogicamente(Instant.now());
        eventos.saveAndFlush(excluido);

        evento(a, "Continua na turma", 7);

        Material materialOculto = material(a, "slide-antigo");
        materialOculto.definirVisibilidadeTurma(false);
        materiais.saveAndFlush(materialOculto);

        NaoListadosResponse naoListados = estadoPessoal.naoListados(eu);

        assertThat(naoListados.eventos()).extracting("titulo")
                .containsExactlyInAnyOrder("Prova adiada", "Entrega cancelada");
        assertThat(naoListados.materiais()).extracting("titulo")
                .containsExactly("slide-antigo");
    }

    /** R15 pelo negativo: registro oculto de outra pessoa nao aparece no meu. */
    @Test
    @DisplayName("R15 — o oculto de outro autor nao aparece no meu nao listados")
    void naoListadosDeOutroAutorNaoAparece() {
        Evento ocultoDeB = evento(b, "Trabalho do Bruno", 3);
        ocultoDeB.definirVisibilidadeTurma(false);
        eventos.saveAndFlush(ocultoDeB);

        Material materialDeB = material(b, "resumo-do-bruno");
        materialDeB.definirVisibilidadeTurma(false);
        materiais.saveAndFlush(materialDeB);

        NaoListadosResponse meus = estadoPessoal.naoListados(eu);

        assertThat(meus.eventos()).isEmpty();
        assertThat(meus.materiais()).isEmpty();
        assertThat(estadoPessoal.naoListados(outro).eventos()).hasSize(1);
    }
}
