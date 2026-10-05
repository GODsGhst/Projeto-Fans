package com.projetofans.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Achado A2 da auditoria de 05/10/2026: os segredos JWT de dev e test estao no
 * git, e com eles qualquer pessoa forja token para qualquer conta. Eles so podem
 * valer na maquina de quem desenvolve.
 */
class SegredoVersionadoTest {

    private static final String DEV = "dev-apenas-nao-use-em-producao-esta-chave-tem-256-bits-de-comprimento";
    private static final String TEST = "test-apenas-chave-de-teste-com-256-bits-de-comprimento-suficiente";
    private static final String GERADO = "Zk3v9QpX2mL7rT8wY1aB4cD6eF0gH5jK8nP3sU7xZ2q=";

    private static MockEnvironment perfil(String... perfis) {
        MockEnvironment ambiente = new MockEnvironment();
        ambiente.setActiveProfiles(perfis);
        return ambiente;
    }

    @Test
    @DisplayName("segredo versionado sobe em dev e test na maquina local")
    void versionadoValeNaMaquinaLocal() {
        assertThatCode(() -> new JwtService(DEV, 1, perfil("dev"))).doesNotThrowAnyException();
        assertThatCode(() -> new JwtService(TEST, 1, perfil("test"))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("segredo versionado em perfil hospedado recusa subir")
    void versionadoEmPerfilHospedadoRecusa() {
        assertThatThrownBy(() -> new JwtService(DEV, 1, perfil("teste")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("JWT_SECRET");
        assertThatThrownBy(() -> new JwtService(TEST, 1, perfil("prod")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("perfil dev no Render recusa subir")
    void devNoRenderRecusa() {
        MockEnvironment render = perfil("dev").withProperty("RENDER", "true");

        assertThatThrownBy(() -> new JwtService(DEV, 1, render))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("segredo proprio sobe em qualquer perfil")
    void segredoProprioSobe() {
        assertThatCode(() -> new JwtService(GERADO, 1, perfil("teste").withProperty("RENDER", "true")))
                .doesNotThrowAnyException();
    }
}
