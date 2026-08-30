package com.projetofans.security;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.repo.MembroRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class TurmaScopeResolverJpa implements TurmaScopeResolver {

    private static final Logger log = LoggerFactory.getLogger(TurmaScopeResolverJpa.class);

    private final MembroRepository membros;

    public TurmaScopeResolverJpa(MembroRepository membros) {
        this.membros = membros;
    }

    @Override
    public UUID turmaDoUsuario(UUID usuarioId) {
        return vinculoAtual(usuarioId).getTurmaId();
    }

    @Override
    public PapelMembro papelDoUsuario(UUID usuarioId) {
        return vinculoAtual(usuarioId).getPapel();
    }

    @Override
    public void exigirMesmaTurma(UUID usuarioId, UUID turmaIdDoRegistro) {
        if (!turmaDoUsuario(usuarioId).equals(turmaIdDoRegistro)) {
            throw new AcessoNegadoException();
        }
    }

    /**
     * Usuario sem vinculo nenhum tambem cai em 404: ele nao esta em turma alguma,
     * entao nenhum registro de turma existe para ele. Devolver null aqui so
     * empurraria um NullPointerException para o proximo metodo.
     */
    private Membro vinculoAtual(UUID usuarioId) {
        List<Membro> vinculos = membros.findByUsuarioIdOrderByEntrouEmDesc(usuarioId);
        if (vinculos.isEmpty()) {
            throw new AcessoNegadoException();
        }
        if (vinculos.size() > 1) {
            // Multiplas turmas esta FORA DE ESCOPO (spec Secao 13). Se este aviso
            // aparecer em producao, alguem implementou a feature por engano — nao
            // e um caso a tratar melhor, e um bug a rastrear.
            log.warn("usuario {} tem {} vinculos de turma; multiplas turmas esta fora de escopo, "
                            + "resolvendo pelo mais recente ({})",
                    usuarioId, vinculos.size(), vinculos.get(0).getTurmaId());
        }
        return vinculos.get(0);
    }
}
