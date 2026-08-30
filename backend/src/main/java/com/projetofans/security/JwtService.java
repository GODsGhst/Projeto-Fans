package com.projetofans.security;

import com.projetofans.erro.TokenInvalidoException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
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
                      @Value("${app.jwt-expiracao-horas}") long expiracaoHoras) {
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
        this.validade = Duration.ofHours(expiracaoHoras);
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
