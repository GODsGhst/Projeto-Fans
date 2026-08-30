package com.projetofans.web.dto;

import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;

import java.util.UUID;

public record MembroDto(UUID id, UUID turmaId, PapelMembro papel) {

    public static MembroDto de(Membro membro) {
        return new MembroDto(membro.getId(), membro.getTurmaId(), membro.getPapel());
    }
}
