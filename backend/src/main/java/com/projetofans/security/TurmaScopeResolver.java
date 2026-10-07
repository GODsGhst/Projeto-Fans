package com.projetofans.security;

import com.projetofans.domain.PapelMembro;

import java.util.UUID;

/**
 * O unico lugar do sistema que sabe resolver a turma de um usuario.
 *
 * turma_id NUNCA e filtrado a mao num controller. Toda tarefa daqui em diante
 * passa por esta interface — e foi so o arquivo da implementacao que mudou quando
 * o docente ganhou varias turmas (spec 2.8): os ~20 chamadores seguem iguais.
 */
public interface TurmaScopeResolver {

    /**
     * Turma ativa do usuario autenticado. Com o cabecalho X-Turma-Id, a turma
     * pedida — se ele for membro dela; sem o cabecalho, o vinculo mais recente.
     */
    UUID turmaDoUsuario(UUID usuarioId);

    /** Papel do usuario na turma dada; AcessoNegadoException (404) se ele nao for membro. */
    PapelMembro papelNaTurma(UUID usuarioId, UUID turmaId);

    /**
     * Papel do usuario na turma ATIVA.
     *
     * Fica so para os chamadores que ainda nao conhecem a turma do registro
     * (ModeracaoService, MateriaService). Quem tem a turma do registro em maos usa
     * {@link #papelNaTurma}: o papel certo e o da turma do registro, nao o da turma
     * que o app deixou ativa. Sai daqui quando o ultimo chamador migrar.
     */
    default PapelMembro papelDoUsuario(UUID usuarioId) {
        return papelNaTurma(usuarioId, turmaDoUsuario(usuarioId));
    }

    /**
     * Lanca AcessoNegadoException (404) se o usuario nao e membro da turma do
     * registro. Independe da turma ativa: o docente abre pelo id um registro de
     * qualquer turma dele sem trocar de turma antes.
     */
    void exigirMesmaTurma(UUID usuarioId, UUID turmaIdDoRegistro);
}
