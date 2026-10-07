package com.projetofans.domain;

import com.projetofans.erro.ErroDeNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A guarda de {@link Membro#mudarPapel} sem Spring nem banco: e regra pura da
 * entidade, e por isso o teste e instantaneo. O caminho HTTP (transferencia pelo
 * lider e pelo admin) esta em {@code BaseDocenteTest}.
 */
class MembroMudarPapelTest {

    private static Membro comPapel(PapelMembro papel) {
        return new Membro(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), papel);
    }

    @ParameterizedTest
    @EnumSource(value = PapelMembro.class, names = {"PROFESSOR", "COORDENADOR"})
    @DisplayName("P13 — docente nao vira LIDER: 409, e o papel dele fica como estava")
    void docenteNaoViraLider(PapelMembro docente) {
        Membro membro = comPapel(docente);

        assertThatThrownBy(() -> membro.mudarPapel(PapelMembro.LIDER))
                .isInstanceOfSatisfying(ErroDeNegocio.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(membro.getPapel()).isEqualTo(docente);
    }

    @Test
    @DisplayName("aluno vira LIDER")
    void alunoViraLider() {
        Membro membro = comPapel(PapelMembro.ALUNO);

        membro.mudarPapel(PapelMembro.LIDER);

        assertThat(membro.getPapel()).isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("LIDER -> LIDER nao muda nada e nao falha (o definirLider do admin e idempotente)")
    void liderContinuaLider() {
        Membro membro = comPapel(PapelMembro.LIDER);

        membro.mudarPapel(PapelMembro.LIDER);

        assertThat(membro.getPapel()).isEqualTo(PapelMembro.LIDER);
    }

    @Test
    @DisplayName("a guarda e so de quem VIRA lider: rebaixar LIDER para ALUNO segue livre")
    void rebaixarSegueLivre() {
        Membro membro = comPapel(PapelMembro.LIDER);

        membro.mudarPapel(PapelMembro.ALUNO);

        assertThat(membro.getPapel()).isEqualTo(PapelMembro.ALUNO);
    }
}
