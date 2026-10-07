package com.projetofans.service;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Nota;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ConflitoVersaoException;
import com.projetofans.erro.NaoAutorException;
import com.projetofans.repo.NotaRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.NotaResponse;
import com.projetofans.web.dto.SalvarNotaRequest;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
    private final Autorias autorias;
    private final TurmaScopeResolver escopo;
    private final EntityManager em;

    public NotaService(NotaRepository notas, Autorias autorias,
                       TurmaScopeResolver escopo, EntityManager em) {
        this.notas = notas;
        this.autorias = autorias;
        this.escopo = escopo;
        this.em = em;
    }

    @Transactional(readOnly = true)
    public List<NotaResponse> doPeriodo(UsuarioAtual eu, LocalDate de, LocalDate ate) {
        UUID turmaId = escopo.turmaDoUsuario(eu.usuarioId());
        List<Nota> encontradas = notas.queEuLeioNoPeriodo(turmaId, eu.usuarioId(), de, ate);
        // Uma Listagem guarda o nome de cada autor (trinta recados da turma no mes
        // repetem cinco nomes) e le os docentes uma vez so, para o selo da coordenacao.
        Autorias.Listagem autoria = autorias.daListagem();
        return encontradas.stream()
                .map(n -> NotaResponse.de(n, autoria.nomeDe(n.getAutorId()), autoria.seloDaNota(n)))
                .toList();
    }

    @Transactional
    public NotaResponse criar(UsuarioAtual autor, SalvarNotaRequest req) {
        UUID turmaId = escopo.turmaDoUsuario(autor.usuarioId());
        Nota nota = new Nota(UUID.randomUUID(), turmaId, autor.usuarioId(),
                req.alcance(), req.data(), req.texto().trim(), Instant.now());
        Nota salva = notas.saveAndFlush(nota);
        em.refresh(salva);
        return resposta(salva, autor);
    }

    @Transactional
    public NotaResponse atualizar(UsuarioAtual eu, UUID notaId, int versionEsperada,
                                  SalvarNotaRequest req) {
        Nota nota = minha(eu, notaId);
        exigirVersao(nota, versionEsperada);
        nota.editar(req.alcance(), req.data(), req.texto().trim(), Instant.now());
        return resposta(notas.saveAndFlush(nota), eu);
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

    /** Criar e editar so acontecem pelo autor: o nome e o do proprio usuario. */
    private NotaResponse resposta(Nota nota, UsuarioAtual autor) {
        return NotaResponse.de(nota, autor.nome(), autorias.daListagem().seloDaNota(nota));
    }

    private static void exigirVersao(Nota nota, int versionEsperada) {
        if (nota.getVersion() != versionEsperada) {
            throw new ConflitoVersaoException(versionEsperada, nota.getVersion());
        }
    }
}
