package com.projetofans.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TransferirLiderancaRequest(@NotNull UUID novoLiderUsuarioId) {
}
