package com.projetofans.web.dto;

import com.projetofans.domain.TipoEvento;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Um item pronto da Home. O cliente renderiza na ordem que veio e nao recalcula
 * nada — a ordenacao, o teto e a janela sao do servidor.
 *
 * Repare em feitoPeloUsuario: ele vem do left join com estado_pessoal, filtrado
 * pelo usuario autenticado. NUNCA de uma coluna em evento — ela nao existe, e
 * cria-la apagaria o nao-negociavel 3 (fato compartilhado nao guarda estado
 * pessoal).
 *
 * Sigla e cor viajam juntas porque a regra visual proibe renderizar so a cor.
 */
public record ItemHomeResponse(
        UUID eventoId,
        TipoEvento tipo,
        String titulo,
        LocalDate data,
        /** Opcional: nem todo evento tem hora, e a Home mostra sem ela. */
        LocalTime hora,
        String materiaSigla,
        String materiaCorHex,
        AutoriaResponse autoria,
        boolean feitoPeloUsuario) {
}
