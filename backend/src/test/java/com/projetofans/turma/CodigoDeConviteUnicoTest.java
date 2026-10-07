package com.projetofans.turma;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.PoderNaTurma;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.TurmaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * O codigo novo nunca colide com um que ja existe.
 *
 * Sorteio de 8 caracteres quase nunca repete, e e justamente por isso que a regra
 * nao aparece num teste de API: nenhum sorteio real colide dentro de uma suite.
 * Aqui o repositorio e simulado para responder "ja existe" duas vezes — se o
 * servico aceitasse o primeiro sorteio, a turma ficaria com o codigo de outra
 * (ou o UNIQUE do banco estouraria num 500 na cara do lider).
 *
 * Unitario de proposito, sem banco: a unica coisa sob teste e o laco.
 */
class CodigoDeConviteUnicoTest {

    @Test
    @DisplayName("trocar o codigo sorteia de novo enquanto o sorteado ja existir")
    void sorteiaDeNovoSeJaExiste() {
        TurmaRepository turmas = mock(TurmaRepository.class);
        MembroRepository membros = mock(MembroRepository.class);
        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        TurmaScopeResolver escopo = mock(TurmaScopeResolver.class);
        MateriaRepository materias = mock(MateriaRepository.class);
        PoderNaTurma poder = mock(PoderNaTurma.class);

        UUID turmaId = UUID.randomUUID();
        UUID liderId = UUID.randomUUID();
        Turma turma = new Turma(turmaId, "Turma", "2026.2", "ANTIGO01");
        when(escopo.turmaDoUsuario(liderId)).thenReturn(turmaId);
        when(membros.findByUsuarioIdAndTurmaId(liderId, turmaId)).thenReturn(
                Optional.of(new Membro(UUID.randomUUID(), liderId, turmaId, PapelMembro.LIDER)));
        when(turmas.findById(turmaId)).thenReturn(Optional.of(turma));
        when(turmas.existsByCodigoConvite(anyString())).thenReturn(true, true, false);
        // trocarCodigo devolve a turma montada (minha), que agora consulta os docentes.
        when(poder.daTurma(turmaId)).thenReturn(PoderNaTurma.Docentes.vazio());

        new TurmaService(turmas, membros, usuarios, escopo, materias, poder)
                .trocarCodigo(new UsuarioAtual(liderId, "Lia"));

        // Dois sorteios recusados, o terceiro aceito.
        verify(turmas, times(3)).existsByCodigoConvite(anyString());
        assertThat(turma.getCodigoConvite()).isNotEqualTo("ANTIGO01").hasSize(8);
    }
}
