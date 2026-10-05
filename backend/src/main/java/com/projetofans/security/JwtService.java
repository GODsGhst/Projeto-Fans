package com.projetofans.security;

import com.projetofans.domain.Usuario;
import com.projetofans.erro.TokenInvalidoException;
import com.projetofans.repo.UsuarioRepository;
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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

/**
 * O JWT proprio do app.
 *
 * O token do Google e trocado por este na porta de entrada e nunca mais aparece:
 * assim os endpoints tem UMA forma de autenticacao, independente de como a pessoa
 * entrou. O segredo vem de configuracao (JWT_SECRET em prod), nunca do codigo.
 *
 * Trocar a senha derruba as sessoes ja emitidas. O token carrega a "versao da
 * senha" (claim `sv`), e o token so vale enquanto ela bate com a do banco. Uma
 * regra so cobre o reset por e-mail e a troca pelo perfil, porque os dois passam
 * por Usuario.trocarSenha — e nao precisou de coluna nova. Antes disto um JWT de
 * 30 dias roubado sobrevivia ao reset de senha da vitima (auditoria de 05/10/2026).
 */
@Service
public class JwtService {

    private static final String VERSAO_DA_SENHA = "sv";

    private final SecretKey chave;
    private final Duration validade;
    private final UsuarioRepository usuarios;

    public JwtService(@Value("${app.jwt-secret}") String segredo,
                      @Value("${app.jwt-expiracao-horas}") long expiracaoHoras,
                      Environment ambiente, UsuarioRepository usuarios) {
        exigirSegredoNaoVersionado(segredo, ambiente);
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
        this.validade = Duration.ofHours(expiracaoHoras);
        this.usuarios = usuarios;
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
        Usuario usuario = usuarios.findById(usuarioId)
                .orElseThrow(() -> new IllegalStateException("emitindo JWT para usuario inexistente"));
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(usuarioId.toString())
                .claim("nome", nome)
                .claim(VERSAO_DA_SENHA, versaoDaSenha(usuario))
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(validade)))
                .signWith(chave)
                .compact();
    }

    /**
     * @throws TokenInvalidoException se a assinatura, o formato ou a validade nao
     *     batem — ou se a conta nao existe mais, ou trocou de senha depois do token.
     */
    public UsuarioAtual validar(String token) {
        Claims dados;
        UUID usuarioId;
        try {
            dados = Jwts.parser().verifyWith(chave).build().parseSignedClaims(token).getPayload();
            usuarioId = UUID.fromString(dados.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            throw new TokenInvalidoException("JWT invalido ou expirado");
        }
        Usuario usuario = usuarios.findById(usuarioId)
                .orElseThrow(() -> new TokenInvalidoException("conta nao existe mais"));
        // Token emitido antes desta regra nao tem `sv` e cai aqui tambem: um login
        // a mais para cada pessoa, uma vez, em troca de o reset valer de verdade.
        if (!versaoDaSenha(usuario).equals(dados.get(VERSAO_DA_SENHA, String.class))) {
            throw new TokenInvalidoException("a senha mudou depois deste token");
        }
        return new UsuarioAtual(usuarioId, dados.get("nome", String.class));
    }

    /**
     * Muda a cada troca de senha, mesmo para a mesma senha, porque o BCrypt sorteia
     * sal novo. E um resumo do hash, e nao o hash: o JWT e legivel por quem o tem,
     * e o hash da senha nao sai do banco. Conta so do Google nao tem senha, e a
     * versao dela fica fixa.
     */
    private static String versaoDaSenha(Usuario usuario) {
        String hash = usuario.getSenhaHash() == null ? "" : usuario.getSenhaHash();
        try {
            byte[] resumo = MessageDigest.getInstance("SHA-256").digest(hash.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumo, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 ausente nesta JVM", e);
        }
    }
}
