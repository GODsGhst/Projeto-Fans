package com.projetofans.web.dto;

import com.projetofans.domain.AlcanceNota;
import com.projetofans.domain.Nota;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * `autorNome` vem preenchido so quando a nota e da TURMA.
 *
 * Numa nota pessoal ele seria sempre o proprio leitor — assinar o rascunho de
 * alguem com o nome dele e ruido, e a tela ja sabe que o que ela mostra como
 * pessoal e dela.
 */
public record NotaResponse(
        UUID id,
        AlcanceNota alcance,
        LocalDate data,
        String texto,
        UUID autorId,
        String autorNome,
        Instant criadoEm,
        Instant atualizadoEm,
        int version,
        boolean visivelTurma) {

    public static NotaResponse de(Nota nota, String autorNome) {
        return new NotaResponse(
                nota.getId(),
                nota.getAlcance(),
                nota.getData(),
                nota.getTexto(),
                nota.getAutorId(),
                nota.getAlcance() == AlcanceNota.TURMA ? autorNome : null,
                nota.getCriadoEm(),
                nota.getAtualizadoEm(),
                nota.getVersion(),
                nota.isVisivelTurma());
    }
}
