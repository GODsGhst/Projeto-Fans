package com.projetofans.security;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Selo;
import com.projetofans.repo.MembroRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O unico lugar que sabe quando um docente tem poder (spec 5.2). Services nao
 * reescrevem a regra: perguntam aqui, e o selo sai da MESMA resposta que o poder
 * (spec 2.6: selo = "esta pessoa tem poder aqui"), entao os dois nao divergem.
 *
 * A regra, em um lugar so:
 *   - COORDENADOR aprovado e nao contestado: alcanca a turma inteira, inclusive o
 *     que nao tem materia (nota da turma);
 *   - PROFESSOR aprovado e nao contestado: so as materias que declarou NESTA turma;
 *   - todo o resto (pendente, recusado, contestado, ALUNO, LIDER): nao alcanca.
 *     O LIDER nao passa por aqui — ele modera pelo PAPEL, nao pelo alcance docente.
 *
 * Nada fica em cache entre requisicoes: {@link #daTurma} le o banco, e o status
 * docente e conferido a cada chamada. E o que faz "recusar" cortar o poder na
 * proxima requisicao do docente, com o mesmo JWT (P16).
 */
@Component
public class PoderNaTurma {

    private static final List<PapelMembro> PAPEIS_DOCENTES =
            List.of(PapelMembro.PROFESSOR, PapelMembro.COORDENADOR);

    private final MembroRepository membros;

    public PoderNaTurma(MembroRepository membros) {
        this.membros = membros;
    }

    /**
     * Os docentes da turma, numa query so. Quem precisa de selo de uma listagem
     * inteira chama UMA vez e consulta o resultado por registro — nunca uma query
     * por item.
     */
    public Docentes daTurma(UUID turmaId) {
        Map<UUID, Docente> porUsuario = new HashMap<>();
        for (Object[] linha : membros.docentesDaTurma(turmaId, PAPEIS_DOCENTES)) {
            UUID usuarioId = (UUID) linha[0];
            Docente docente = porUsuario.computeIfAbsent(usuarioId, id -> new Docente(
                    (PapelMembro) linha[1], (DocenteStatus) linha[2], linha[3] != null,
                    new HashSet<>()));
            if (linha[4] != null) {
                docente.lecionadas().add((UUID) linha[4]);
            }
        }
        return new Docentes(porUsuario);
    }

    /** Papel do VINCULO, status da CONTA, contestacao do VINCULO e o que declarou. */
    public record Docente(PapelMembro papel, DocenteStatus status, boolean contestado,
                   Set<UUID> lecionadas) {

        /** Conta aprovada e vinculo nao contestado: so isto abre o poder (spec 2.2 e 2.4). */
        boolean comPoder() {
            return status == DocenteStatus.APROVADO && !contestado;
        }
    }

    public enum Tipo { NENHUM, MATERIAS, TURMA }

    /**
     * O alcance de UMA pessoa, no formato de `meuAlcance` em GET /turmas/minha.
     * `materiaIds` so tem conteudo em MATERIAS.
     */
    public record Alcance(Tipo tipo, List<UUID> materiaIds) {
        static final Alcance NENHUM = new Alcance(Tipo.NENHUM, List.of());
    }

    public record Docentes(Map<UUID, Docente> porUsuario) {

        /** Turma sem docentes, para teste de service que nao quer subir o banco. */
        public static Docentes vazio() {
            return new Docentes(Map.of());
        }

        /**
         * `materiaIdOuNull` nulo = registro sem materia (nota da turma): so a
         * coordenacao alcanca. Professor com materia nula nunca alcanca.
         */
        public boolean alcanca(UUID usuarioId, UUID materiaIdOuNull) {
            Docente d = porUsuario.get(usuarioId);
            if (d == null || !d.comPoder()) {
                return false;
            }
            return switch (d.papel()) {
                case COORDENADOR -> true;
                case PROFESSOR -> materiaIdOuNull != null && d.lecionadas().contains(materiaIdOuNull);
                default -> false;
            };
        }

        /** O selo que esta pessoa assina neste registro; nulo quando nao ha poder nele. */
        public Selo selo(UUID usuarioId, UUID materiaIdOuNull) {
            if (!alcanca(usuarioId, materiaIdOuNull)) {
                return null;
            }
            return porUsuario.get(usuarioId).papel() == PapelMembro.COORDENADOR
                    ? Selo.COORDENACAO : Selo.PROFESSOR;
        }

        /**
         * O selo da pessoa na turma como um todo, para a lista de membros: a
         * coordenacao com poder tem COORDENACAO; o professor com poder em pelo
         * menos uma materia tem PROFESSOR. Professor aprovado que ainda nao
         * declarou nada nao tem poder em lugar nenhum, entao nao tem selo.
         */
        public Selo seloGeral(UUID usuarioId) {
            return switch (alcance(usuarioId).tipo()) {
                case TURMA -> Selo.COORDENACAO;
                case MATERIAS -> Selo.PROFESSOR;
                case NENHUM -> null;
            };
        }

        /** O que o docente declarou nesta turma, com ou sem poder (a declaracao e dele). */
        public Set<UUID> lecionadas(UUID usuarioId) {
            Docente d = porUsuario.get(usuarioId);
            return d == null ? Set.of() : d.lecionadas();
        }

        public Alcance alcance(UUID usuarioId) {
            Docente d = porUsuario.get(usuarioId);
            if (d == null || !d.comPoder()) {
                return Alcance.NENHUM;
            }
            if (d.papel() == PapelMembro.COORDENADOR) {
                return new Alcance(Tipo.TURMA, List.of());
            }
            if (d.papel() == PapelMembro.PROFESSOR && !d.lecionadas().isEmpty()) {
                // Ordem estavel: o JSON nao pode mudar de ordem a cada abertura.
                return new Alcance(Tipo.MATERIAS,
                        d.lecionadas().stream().sorted().toList());
            }
            return Alcance.NENHUM;
        }
    }
}
