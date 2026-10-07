package com.projetofans.service;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Evento;
import com.projetofans.domain.Material;
import com.projetofans.domain.Nota;
import com.projetofans.domain.Selo;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.web.dto.AutoriaResponse;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * O unico construtor de autoria (spec PC7). Nenhum service monta {@link AutoriaResponse}
 * nem calcula selo a mao.
 *
 * Uma {@link Listagem} por resposta: ela le os docentes da turma UMA vez
 * ({@link PoderNaTurma#daTurma}) e responde o selo de cada registro da memoria. O selo
 * sai da mesma fonte que o poder, entao "tem selo" e "pode corrigir" nao divergem —
 * contestar o professor tira os dois na proxima requisicao. Nada fica em cache entre
 * requisicoes: a Listagem morre com a resposta.
 */
@Component
public class Autorias {

    private final UsuarioRepository usuarios;
    private final PoderNaTurma poder;

    public Autorias(UsuarioRepository usuarios, PoderNaTurma poder) {
        this.usuarios = usuarios;
        this.poder = poder;
    }

    /** Uma por listagem: nao guarde entre requisicoes. */
    public Listagem daListagem() {
        return new Listagem();
    }

    public final class Listagem {

        // Por turma, e nao uma so: "Nao listados" de um docente de varias turmas mistura turmas.
        // Uma listagem de turma unica (todas as outras) faz exatamente uma leitura.
        private final Map<UUID, PoderNaTurma.Docentes> docentes = new HashMap<>();
        private final Map<UUID, String> nomes = new HashMap<>();

        private Listagem() {
        }

        /**
         * Carrega os nomes de uma vez. Opcional: so para listagens que podem ser a turma
         * inteira (o delta do /sync); nas demais o findById por autor se resolve no cache
         * de primeiro nivel da transacao.
         */
        public void carregarNomes(Collection<UUID> usuarioIds) {
            usuarios.findAllById(usuarioIds.stream().filter(id -> !nomes.containsKey(id)).distinct().toList())
                    .forEach(u -> nomes.put(u.getId(), u.getNome()));
        }

        public AutoriaResponse de(Evento e) {
            return de(e.getTurmaId(), e.getAutorId(), e.getAtualizadoPor(), e.getMateriaId(),
                    e.getCriadoEm(), e.getAtualizadoEm());
        }

        public AutoriaResponse de(Material m) {
            return de(m.getTurmaId(), m.getAutorId(), m.getAtualizadoPor(), m.getMateriaId(),
                    m.getCriadoEm(), m.getAtualizadoEm());
        }

        /**
         * `editadoPor*` so quando atualizado_por existe e difere do autor: o autor
         * corrigindo a si mesmo nao e "editado por", e legado/nunca editado e nulo.
         * O selo de quem editou e o de AGORA na materia do registro, como o do autor.
         */
        public AutoriaResponse de(UUID turmaId, UUID autorId, UUID atualizadoPor, UUID materiaId,
                                  Instant criadoEm, Instant atualizadoEm) {
            PoderNaTurma.Docentes daTurma = docentesDa(turmaId);
            boolean editadoPorOutro = atualizadoPor != null && !atualizadoPor.equals(autorId);
            return new AutoriaResponse(autorId, nomeDe(autorId), daTurma.selo(autorId, materiaId),
                    criadoEm, atualizadoEm,
                    editadoPorOutro ? nomeDe(atualizadoPor) : null,
                    editadoPorOutro ? daTurma.selo(atualizadoPor, materiaId) : null);
        }

        /**
         * Selo do autor de uma nota: so a COORDENACAO, e so em nota da TURMA. Nota nao tem
         * materia (professor nunca alcanca) e a PESSOAL nao e assinada para ninguem.
         */
        public Selo seloDaNota(Nota nota) {
            if (nota.getAlcance() != AlcanceNota.TURMA) {
                return null;
            }
            return docentesDa(nota.getTurmaId()).selo(nota.getAutorId(), null);
        }

        public String nomeDe(UUID usuarioId) {
            return nomes.computeIfAbsent(usuarioId,
                    id -> usuarios.findById(id).map(Usuario::getNome).orElse("Desconhecido"));
        }

        private PoderNaTurma.Docentes docentesDa(UUID turmaId) {
            return docentes.computeIfAbsent(turmaId, poder::daTurma);
        }
    }
}
