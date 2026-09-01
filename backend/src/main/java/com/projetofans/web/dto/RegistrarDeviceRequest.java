package com.projetofans.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * `plataforma` e validada aqui contra a mesma lista do CHECK
 * `device_plataforma_valida`. Sem isso, um valor errado viraria 500 vindo da
 * constraint — resposta correta pelo motivo errado, e ilegivel para o app.
 */
public record RegistrarDeviceRequest(
        @NotBlank String fcmToken,
        @NotBlank @Pattern(regexp = "android|ios|web") String plataforma) {
}
