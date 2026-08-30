package com.projetofans.service;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

/**
 * Criar turma e entrar em turma.
 *
 * Quem cria vira LIDER; quem entra por convite vira ALUNO. Nao existe fila de
 * aprovacao: o codigo de convite JA e o controle de entrada, e postar depois disso
 * e livre, sem gate e sem status pendente.
 */
@Service
public class TurmaService {

    private final TurmaRepository turmas;
    private final MembroRepository membros;

    public TurmaService(TurmaRepository turmas, MembroRepository membros) {
        this.turmas = turmas;
        this.membros = membros;
    }

    @Transactional
    public Turma criar(UUID criadorId, String nome, String semestre) {
        Turma turma = turmas.save(new Turma(UUID.randomUUID(), nome, semestre, novoCodigoConvite()));
        membros.save(new Membro(UUID.randomUUID(), criadorId, turma.getId(), PapelMembro.LIDER));
        return turma;
    }

    /**
     * Codigo invalido responde 404, nunca 403 nem 400 com mensagem propria: quem
     * chuta codigo nao pode aprender nada sobre quais existem.
     *
     * Idempotente de proposito — tocar duas vezes no botao nao pode estourar o
     * UNIQUE (usuario_id, turma_id) na cara do aluno.
     */
    @Transactional
    public Membro entrar(UUID usuarioId, String codigoConvite) {
        Turma turma = turmas.findByCodigoConvite(codigoConvite)
                .orElseThrow(AcessoNegadoException::new);
        return membros.findByUsuarioIdAndTurmaId(usuarioId, turma.getId())
                .orElseGet(() -> membros.save(
                        new Membro(UUID.randomUUID(), usuarioId, turma.getId(), PapelMembro.ALUNO)));
    }

    /**
     * 8 caracteres de UUID em caixa alta, para caber num quadro branco.
     * ponytail: colisao e improvavel e o UNIQUE do banco a recusa; se um dia isso
     * incomodar, o conserto e um retry aqui, nao um gerador mais esperto.
     */
    private String novoCodigoConvite() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }
}
