package com.projetofans.docente;

import com.fasterxml.jackson.databind.JsonNode;
import com.projetofans.domain.Evento;
import com.projetofans.domain.EventoMaterial;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.ProfessorMateria;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.TipoEvento;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.EventoMaterialRepository;
import com.projetofans.repo.ProfessorMateriaRepository;
import com.projetofans.support.TesteDeApi;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * O cenario que as suites de edicao alheia, autoria com selo e painel compartilham:
 * uma turma com duas materias, lider, aluno, um professor APROVADO que declarou so
 * Calculo e um coordenador APROVADO. Existe para as tres suites nao repetirem as
 * mesmas ~60 linhas de montagem — e para o que elas chamam de "docente" significar
 * exatamente a mesma coisa nas tres.
 *
 * Tudo vai direto para as tabelas (repositorios), nunca pela API de cadastro: o que
 * se testa aqui e o efeito do estado docente, nao o caminho que levou a ele.
 */
abstract class CenarioDocente extends TesteDeApi {

    @Autowired protected ProfessorMateriaRepository lecionadas;
    @Autowired protected EventoMaterialRepository vinculos;
    @Autowired protected EntityManager em;

    protected Turma turma;
    protected Materia calculo;
    protected Materia fisica;
    protected Usuario lider;
    protected Usuario aluno;
    protected Usuario prof;
    protected Usuario coord;

    @BeforeEach
    void cenarioDocente() {
        turma = novaTurma();
        calculo = novaMateria(turma);
        fisica = materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Fisica", "FIS", "#1F6FB2"));
        lider = membroDe(turma, "Lia", PapelMembro.LIDER);
        aluno = membroDe(turma, "Ana", PapelMembro.ALUNO);
        prof = docenteAprovado(turma, "Paulo", TipoConta.PROFESSOR, calculo);
        coord = docenteAprovado(turma, "Carla", TipoConta.COORDENADOR);
    }

    // ---- docentes ---------------------------------------------------------------

    /** Conta PENDENTE, vinculada a turma e com as materias declaradas (inertes ate aprovar). */
    protected Usuario docentePendente(Turma t, String nome, TipoConta tipo, Materia... declara) {
        Usuario u = usuarios.saveAndFlush(Usuario.comSenha(UUID.randomUUID(), nome,
                "d-" + UUID.randomUUID() + "@ex.dev", "hash", tipo));
        membros.saveAndFlush(new Membro(UUID.randomUUID(), u.getId(), t.getId(),
                PapelMembro.valueOf(tipo.name())));
        for (Materia m : declara) {
            lecionadas.saveAndFlush(new ProfessorMateria(u.getId(), m.getId()));
        }
        return u;
    }

    protected Usuario docenteAprovado(Turma t, String nome, TipoConta tipo, Materia... declara) {
        return decidir(docentePendente(t, nome, tipo, declara), true);
    }

    protected Usuario docenteRecusado(Turma t, String nome, TipoConta tipo, Materia... declara) {
        return decidir(docentePendente(t, nome, tipo, declara), false);
    }

    private Usuario decidir(Usuario docente, boolean aprovado) {
        docente.decidirDocente(aprovado, novoUsuario("Admin").getId(), Instant.now());
        return usuarios.saveAndFlush(docente);
    }

    /** As tres maneiras de um professor existir na turma sem ter poder nela (spec 5, 2.2 e 2.4). */
    enum SemPoder { PENDENTE, RECUSADO, CONTESTADO }

    protected Usuario professorSemPoder(SemPoder situacao, String nome, Materia... declara) {
        return switch (situacao) {
            case PENDENTE -> docentePendente(turma, nome, TipoConta.PROFESSOR, declara);
            case RECUSADO -> docenteRecusado(turma, nome, TipoConta.PROFESSOR, declara);
            case CONTESTADO -> {
                Usuario u = docenteAprovado(turma, nome, TipoConta.PROFESSOR, declara);
                contestar(u);
                yield u;
            }
        };
    }

    /** O lider contesta o docente NESTA turma: o poder e o selo caem, a conta continua aprovada. */
    protected void contestar(Usuario docente) {
        Membro vinculo = membros.findByUsuarioIdAndTurmaId(docente.getId(), turma.getId()).orElseThrow();
        vinculo.contestar(lider.getId(), Instant.now());
        membros.saveAndFlush(vinculo);
    }

    // ---- registros --------------------------------------------------------------

    protected Evento evento(Materia m, Usuario autor) {
        return evento(m, autor, "Prova 1", LocalDate.now().plusDays(3));
    }

    protected Evento evento(Materia m, Usuario autor, String titulo, LocalDate data) {
        return eventos.saveAndFlush(new Evento(UUID.randomUUID(), turma.getId(), m.getId(),
                TipoEvento.PROVA, titulo, data, null, autor.getId(), Instant.now()));
    }

    protected Material material(Materia m, Usuario autor) {
        return materiais.saveAndFlush(new Material(UUID.randomUUID(), turma.getId(), m.getId(),
                TipoMaterial.AULA, "Slides", "https://ex.dev/slides", autor.getId(), Instant.now()));
    }

    protected void vincular(Evento e, Material m, Usuario quem) {
        vinculos.saveAndFlush(new EventoMaterial(e.getId(), m.getId(), quem.getId()));
    }

    // ---- chamadas ---------------------------------------------------------------

    /** PATCH que substitui o evento por inteiro; `ifMatch` nulo = sem o cabecalho. */
    protected ResultActions patchEvento(Usuario quem, Evento e, Materia destino, String titulo,
                                        Integer ifMatch) throws Exception {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", destino.getId().toString());
        pedido.put("tipo", "PROVA");
        pedido.put("titulo", titulo);
        pedido.put("data", e.getDataEvento().toString());
        return http.perform(comIfMatch(patch("/api/v1/eventos/" + e.getId()), quem, ifMatch)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo(pedido)));
    }

    protected ResultActions patchMaterial(Usuario quem, Material m, Materia destino, String titulo,
                                          Integer ifMatch) throws Exception {
        Map<String, Object> pedido = new HashMap<>();
        pedido.put("materiaId", destino.getId().toString());
        pedido.put("tipo", "AULA");
        pedido.put("titulo", titulo);
        pedido.put("url", "https://ex.dev/slides");
        return http.perform(comIfMatch(patch("/api/v1/materiais/" + m.getId()), quem, ifMatch)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo(pedido)));
    }

    protected ResultActions lerComo(Usuario quem, String caminho) throws Exception {
        return http.perform(get(caminho).header("Authorization", bearer(quem)));
    }

    protected ResultActions postar(Usuario quem, String caminho) throws Exception {
        return http.perform(post(caminho).header("Authorization", bearer(quem)));
    }

    protected JsonNode corpoDe(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder comIfMatch(MockHttpServletRequestBuilder req,
                                                      Usuario quem, Integer ifMatch) {
        req.header("Authorization", bearer(quem));
        return ifMatch == null ? req : req.header("If-Match", ifMatch);
    }
}
