package com.projetofans.security;

import com.projetofans.erro.TokenInvalidoException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * O JWT proprio do app.
 *
 * O token do Google e trocado por este na porta de entrada e nunca mais aparece:
 * assim os endpoints tem UMA forma de autenticacao, independente de como a pessoa
 * entrou. O segredo vem de configuracao (JWT_SECRET em prod), nunca do codigo.
 */
@Service
public class JwtService {

    private final SecretKey chave;
    private final Duration validade;

    public JwtService(@Value("${app.jwt-secret}") String segredo,
                      @Value("${app.jwt-expiracao-horas}") long expiracaoHoras,
                      Environment ambiente) {
        exigirSegredoNaoVersionado(segredo, ambiente);
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
        this.validade = Duration.ofHours(expiracaoHoras);
    }

    /**
     * Os segredos de dev e test estao no git (application.yml): com eles qualquer
     * pessoa forja um JWT com o UUID de outra e entra na conta dela. So valem na
     * maquina de quem desenvolve — perfil dev ou test E fora do Render, que injeta
     * RENDER em todo servico. Qualquer outra combinacao recusa subir, em vez de
     * subir aberta. Achado A2 da auditoria de 05/10/2026.
     */
    static void exigirSegredoNaoVersionado(String segredo, Environment ambiente) {
        boolean versionado = segredo.startsWith("dev-") || segredo.startsWith("test-");
        boolean maquinaLocal = ambiente.acceptsProfiles(Profiles.of("dev | test"))
                && !ambiente.containsProperty("RENDER");
        if (versionado && !maquinaLocal) {
            throw new IllegalStateException("app.jwt-secret e o segredo versionado de dev/test;"
                    + " fora da maquina local defina JWT_SECRET com um valor proprio");
        }
    }

    public String emitir(UUID usuarioId, String nome) {
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(usuarioId.toString())
                .claim("nome", nome)
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(validade)))
                .signWith(chave)
                .compact();
    }

    /** @throws TokenInvalidoException se a assinatura, o formato ou a validade nao batem. */
    public UsuarioAtual validar(String token) {
        try {
            Claims dados = Jwts.parser().verifyWith(chave).build()
                    .parseSignedClaims(token).getPayload();
            return new UsuarioAtual(UUID.fromString(dados.getSubject()), dados.get("nome", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            throw new TokenInvalidoException("JWT invalido ou expirado");
        }
    }
}
