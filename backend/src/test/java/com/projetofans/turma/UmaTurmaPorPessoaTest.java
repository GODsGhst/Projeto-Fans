package com.projetofans.turma;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.support.TesteDeApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Quem ja esta numa turma nao cria nem entra em outra. Antes, os dois davam 200 e
 * o TurmaScopeResolver passava a resolver pelo vinculo mais recente: a turma de
 * origem sumia do app da pessoa sem aviso nenhum.
 */
class UmaTurmaPorPessoaTest extends TesteDeApi {

    private void postar(Usuario quem, String rota, Map<String, Object> corpo, int esperado) throws Exception {
        var r = http.perform(post(rota).header("Authorization", bearer(quem))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo(corpo)))
                .andExpect(status().is(esperado));
        if (esperado == 409) {
            r.andExpect(jsonPath("$.detail").value("Voce ja esta numa turma"));
        }
    }

    private void continuaSoNa(Usuario quem, Turma turma) {
        assertThat(membros.findByUsuarioIdOrderByEntrouEmDesc(quem.getId()))
                .singleElement()
                .extracting(Membro::getTurmaId)
                .isEqualTo(turma.getId());
    }

    @Test
    @DisplayName("aluno com turma que usa o codigo de outra leva 409 e continua na sua")
    void entrarEmOutraDa409() throws Exception {
        Turma minha = novaTurma();
        Usuario aluno = membroDe(minha, "Ana", PapelMembro.ALUNO);

        postar(aluno, "/api/v1/turmas/entrar", Map.of("codigoConvite", novaTurma().getCodigoConvite()), 409);

        continuaSoNa(aluno, minha);
    }

    @Test
    @DisplayName("lider com turma que tenta criar outra leva 409 e continua na sua")
    void criarOutraDa409() throws Exception {
        Turma minha = novaTurma();
        Usuario lider = membroDe(minha, "Otavio", PapelMembro.LIDER);

        postar(lider, "/api/v1/turmas", Map.of("nome", "Segunda", "semestre", "2026.2"), 409);

        continuaSoNa(lider, minha);
    }

    @Test
    @DisplayName("o codigo da propria turma continua idempotente: 200, sem segundo vinculo")
    void entrarNaPropriaContinuaIdempotente() throws Exception {
        // Toque duplo no botao "Entrar" nao pode virar erro na cara do aluno.
        Turma minha = novaTurma();
        Usuario aluno = membroDe(minha, "Ana", PapelMembro.ALUNO);

        postar(aluno, "/api/v1/turmas/entrar", Map.of("codigoConvite", minha.getCodigoConvite()), 200);

        continuaSoNa(aluno, minha);
    }
}
