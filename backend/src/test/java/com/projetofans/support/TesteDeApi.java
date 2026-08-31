package com.projetofans.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.RevisaoRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Base dos testes de API: banco de verdade, MockMvc e as pecas de cenario que
 * toda tarefa de CRUD precisa montar — turma, usuario, vinculo e materia.
 *
 * Existe porque as tres suites da Task 4 montavam exatamente o mesmo cenario. O
 * JWT sai do JwtService real: passar pelo filtro de verdade e o que garante que
 * o UsuarioAtual injetado no controller e o mesmo que a producao veria.
 */
@Transactional
@AutoConfigureMockMvc
public abstract class TesteDeApi extends TesteComPostgres {

    @Autowired protected MockMvc http;
    @Autowired protected ObjectMapper json;
    @Autowired protected UsuarioRepository usuarios;
    @Autowired protected TurmaRepository turmas;
    @Autowired protected MembroRepository membros;
    @Autowired protected MateriaRepository materias;
    @Autowired protected EventoRepository eventos;
    @Autowired protected MaterialRepository materiais;
    @Autowired protected RevisaoRepository revisoes;
    @Autowired protected JwtService jwt;

    protected Turma novaTurma() {
        return turmas.saveAndFlush(new Turma(
                UUID.randomUUID(), "Turma", "2026.2", "CONV-" + UUID.randomUUID()));
    }

    protected Usuario novoUsuario(String nome) {
        return usuarios.saveAndFlush(Usuario.comSenha(
                UUID.randomUUID(), nome, "u-" + UUID.randomUUID() + "@ex.dev", "hash"));
    }

    /** Cria o usuario ja vinculado a turma. */
    protected Usuario membroDe(Turma turma, String nome, PapelMembro papel) {
        Usuario usuario = novoUsuario(nome);
        membros.saveAndFlush(new Membro(UUID.randomUUID(), usuario.getId(), turma.getId(), papel));
        return usuario;
    }

    protected String bearer(Usuario usuario) {
        return "Bearer " + jwt.emitir(usuario.getId(), usuario.getNome());
    }

    protected Materia novaMateria(Turma turma) {
        return materias.saveAndFlush(new Materia(
                UUID.randomUUID(), turma.getId(), "Calculo", "CAL", "#1F6FB2"));
    }

    protected String corpo(Object valor) throws Exception {
        return json.writeValueAsString(valor);
    }
}
