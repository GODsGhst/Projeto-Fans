package com.projetofans.web.dto;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Nota;
import com.projetofans.domain.Selo;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * `autorNome` vem preenchido so quando a nota e da TURMA.
 *
 * Numa nota pessoal ele seria sempre o proprio leitor — assinar o rascunho de
 * alguem com o nome dele e ruido, e a tela ja sabe que o que ela mostra como
 * pessoal e dela.
 *
 * `autorSelo` so existe em nota da TURMA escrita por quem tem COORDENACAO (a nota nao
 * tem materia, entao professor nunca alcanca). Omitido quando nulo, como na autoria.
 */
public record NotaResponse(
        UUID id,
        AlcanceNota alcance,
        LocalDate data,
        String texto,
        UUID autorId,
        String autorNome,
        Selo autorSelo,
        Instant criadoEm,
        Instant atualizadoEm,
        int version,
        boolean visivelTurma) {

    public static NotaResponse de(Nota nota, String autorNome, Selo autorSelo) {
        return new NotaResponse(
                nota.getId(),
                nota.getAlcance(),
                nota.getData(),
                nota.getTexto(),
                nota.getAutorId(),
                nota.getAlcance() == AlcanceNota.TURMA ? autorNome : null,
                autorSelo,
                nota.getCriadoEm(),
                nota.getAtualizadoEm(),
                nota.getVersion(),
                nota.isVisivelTurma());
    }
}
