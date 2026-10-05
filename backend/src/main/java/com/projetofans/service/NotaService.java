package com.projetofans.service;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Nota;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ConflitoVersaoException;
import com.projetofans.erro.NaoAutorException;
import com.projetofans.repo.NotaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.NotaResponse;
import com.projetofans.web.dto.SalvarNotaRequest;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Anotacoes do dia. Mesmo contrato de evento e material: autor-only, If-Match,
 * exclusao logica.
 *
 * A UNICA REGRA NOVA, E A QUE NAO PODE FALHAR
 * Nota PESSOAL so volta para quem a escreveu. Ela e imposta na query
 * (`queEuLeioNoPeriodo`) e nao numa filtragem em Java depois de buscar: dado
 * que nao sai do banco nao vaza por um `map` que alguem esqueceu de filtrar.
 * `buscarUma` nao existe de proposito — sem GET por id nao ha o caminho obvio
 * de ler a nota pessoal de outra pessoa adivinhando o UUID.
 *
 * O QUE FICOU DE FORA, E ESTA ESCRITO PARA NAO PARECER ESQUECIMENTO
 * O lider nao modera nota. Ele oculta evento e material; nota da turma ainda
 * nao passa por ele. Quando entrar, entra como as outras: coluna
 * `visivel_turma` e um RegistroTipo novo.
 *
 * Nao ha revisao (`RevisaoService`) tambem de proposito: o diario existe para
 * dar rastro ao que a turma combinou. Rascunho pessoal nao e combinado com
 * ninguem, e guardar versao antiga de rascunho alheio e o oposto do que a
 * coluna `alcance` promete.
 */
@Service
public class NotaService {

    private final NotaRepository notas;
    private final UsuarioRepository usuarios;
    private final TurmaScopeResolver escopo;
    private final EntityManager em;

    public NotaService(NotaRepository notas, UsuarioRepository usuarios,
                       TurmaScopeResolver escopo, EntityManager em) {
        this.notas = notas;
        this.usuarios = usuarios;
        this.escopo = escopo;
        this.em = em;
    }

    @Transactional(readOnly = true)
    public List<NotaResponse> doPeriodo(UsuarioAtual eu, LocalDate de, LocalDate ate) {
        UUID turmaId = escopo.turmaDoUsuario(eu.usuarioId());
        List<Nota> encontradas = notas.queEuLeioNoPeriodo(turmaId, eu.usuarioId(), de, ate);
        // Um mapa de nomes, e nao um findById por nota: trinta recados da turma
        // no mes dariam trinta consultas para repetir cinco nomes.
        Map<UUID, String> nomes = new HashMap<>();
        return encontradas.stream()
                .map(n -> NotaResponse.de(n, nomes.computeIfAbsent(n.getAutorId(), this::nomeDe)))
                .toList();
    }

    @Transactional
    public NotaResponse criar(UsuarioAtual autor, SalvarNotaRequest req) {
        UUID turmaId = escopo.turmaDoUsuario(autor.usuarioId());
        Nota nota = new Nota(UUID.randomUUID(), turmaId, autor.usuarioId(),
                req.alcance(), req.data(), req.texto().trim(), Instant.now());
        Nota salva = notas.saveAndFlush(nota);
        em.refresh(salva);
        return NotaResponse.de(salva, autor.nome());
    }

    @Transactional
    public NotaResponse atualizar(UsuarioAtual eu, UUID notaId, int versionEsperada,
                                  SalvarNotaRequest req) {
        Nota nota = minha(eu, notaId);
        exigirVersao(nota, versionEsperada);
        nota.editar(req.alcance(), req.data(), req.texto().trim(), Instant.now());
        return NotaResponse.de(notas.saveAndFlush(nota), eu.nome());
    }

    @Transactional
    public void excluirLogicamente(UsuarioAtual eu, UUID notaId, int versionEsperada) {
        Nota nota = minha(eu, notaId);
        exigirVersao(nota, versionEsperada);
        nota.excluirLogicamente(Instant.now());
        notas.saveAndFlush(nota);
    }

    /**
     * A nota, se ela e minha.
     *
     * Escopo de turma ANTES de autoria, na ordem: fora da turma o registro nao
     * existe (404), dentro dela e de outra pessoa ele existe e nao e seu (403).
     * Inverter faria o 403 confirmar, para quem esta fora, que aquele id existe.
     */
    private Nota minha(UsuarioAtual eu, UUID notaId) {
        Nota nota = notas.findById(notaId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(eu.usuarioId(), nota.getTurmaId());
        // Nota PESSOAL alheia nem existe para mim: 403 confirmaria que ela esta la.
        boolean pessoalAlheia = nota.getAlcance() != AlcanceNota.TURMA
                && !nota.getAutorId().equals(eu.usuarioId());
        if (nota.getExcluidoEm() != null || pessoalAlheia) {
            throw new AcessoNegadoException();
        }
        if (!nota.getAutorId().equals(eu.usuarioId())) {
            throw new NaoAutorException();
        }
        return nota;
    }

    private String nomeDe(UUID usuarioId) {
        return usuarios.findById(usuarioId).map(u -> u.getNome()).orElse("alguém");
    }

    private static void exigirVersao(Nota nota, int versionEsperada) {
        if (nota.getVersion() != versionEsperada) {
            throw new ConflitoVersaoException(versionEsperada, nota.getVersion());
        }
    }
}
