package com.projetofans.service;

import com.projetofans.domain.Membro;
import com.projetofans.domain.TokenResetSenha;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.erro.TokenInvalidoException;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TokenResetSenhaRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.GoogleIdentidade;
import com.projetofans.security.GoogleTokenVerifier;
import com.projetofans.security.JwtService;
import com.projetofans.web.dto.AuthResponse;
import com.projetofans.web.dto.UsuarioDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Os dois caminhos de identidade e a recuperacao de senha.
 *
 * Identidade e vinculo com a turma sao coisas separadas: aqui a conta se cria
 * livremente, e entrar na sala (TurmaService) exige o codigo de convite. O codigo
 * e a fronteira de confianca, nao o provedor de login.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration VALIDADE_TOKEN_RESET = Duration.ofHours(1);

    private final UsuarioRepository usuarios;
    private final MembroRepository membros;
    private final TokenResetSenhaRepository tokensReset;
    private final PasswordEncoder senhas;
    private final JwtService jwt;
    private final GoogleTokenVerifier google;
    private final EmailSender email;

    public AuthService(UsuarioRepository usuarios, MembroRepository membros, TokenResetSenhaRepository tokensReset,
                       PasswordEncoder senhas, JwtService jwt,
                       GoogleTokenVerifier google, EmailSender email) {
        this.membros = membros;
        this.usuarios = usuarios;
        this.tokensReset = tokensReset;
        this.senhas = senhas;
        this.jwt = jwt;
        this.google = google;
        this.email = email;
    }

    public AuthResponse registrar(String nome, String endereco, String senha) {
        if (usuarios.existsByEmail(endereco)) {
            // 409, e nao 400: o pedido esta bem formado, o estado do servidor e que conflita.
            throw new ErroDeNegocio(HttpStatus.CONFLICT, "Ja existe conta com este e-mail");
        }
        Usuario novo = usuarios.save(Usuario.comSenha(
                UUID.randomUUID(), nome, endereco, senhas.encode(senha)));
        return resposta(novo);
    }

    public AuthResponse login(String endereco, String senha) {
        Usuario usuario = usuarios.findByEmail(endereco).orElse(null);
        // Mesma resposta para "e-mail nao existe" e "senha errada": distinguir os
        // dois transformaria o login num enumerador de contas.
        if (usuario == null || usuario.getSenhaHash() == null
                || !senhas.matches(senha, usuario.getSenhaHash())) {
            throw new ErroDeNegocio(HttpStatus.UNAUTHORIZED, "E-mail ou senha invalidos");
        }
        return resposta(usuario);
    }

    @Transactional
    public AuthResponse entrarComGoogle(String idToken) {
        GoogleIdentidade identidade = google.verificar(idToken);

        // Sem email_verified nao da para tratar o e-mail como identidade — e e
        // exatamente isso que o vinculo automatico abaixo faz ao converter
        // "mesmo e-mail" em "mesma pessoa". Um dominio Workspace pode emitir
        // token com e-mail nao confirmado; sem esta guarda, quem apresentasse
        // esse token assumiria a conta de quem entrou por senha com aquele
        // e-mail. Checar aqui, e nao so no verificador, porque a consequencia
        // mora aqui — e porque assim o teste alcanca a regra pelo fake.
        if (!identidade.emailVerificado()) {
            throw new TokenInvalidoException("o Google nao confirmou este e-mail");
        }

        Optional<Usuario> porSub = usuarios.findByGoogleSub(identidade.sub());
        if (porSub.isPresent()) {
            return resposta(porSub.get());
        }
        // Mesma pessoa que ja tinha conta por e-mail+senha: liga o Google nela em
        // vez de criar uma segunda conta com o mesmo e-mail (que o UNIQUE recusaria).
        Optional<Usuario> porEmail = usuarios.findByEmail(identidade.email());
        if (porEmail.isPresent()) {
            Usuario existente = porEmail.get();
            existente.vincularGoogle(identidade.sub());
            return resposta(usuarios.save(existente));
        }
        Usuario novo = usuarios.save(Usuario.doGoogle(
                UUID.randomUUID(), identidade.nome(), identidade.email(), identidade.sub()));
        return resposta(novo);
    }

    /**
     * Sempre 204, exista o e-mail ou nao. Resposta diferente vazaria a lista de
     * quem tem conta no app — e requisito de seguranca, nao cortesia.
     */
    @Transactional
    public void esqueciSenha(String endereco) {
        Optional<Usuario> usuario = usuarios.findByEmail(endereco);
        if (usuario.isEmpty()) {
            log.info("pedido de reset para e-mail sem conta; respondendo 204 assim mesmo");
            return;
        }
        String token = UUID.randomUUID().toString();
        tokensReset.save(new TokenResetSenha(UUID.randomUUID(), usuario.get().getId(),
                hashDe(token), Instant.now().plus(VALIDADE_TOKEN_RESET)));
        try {
            email.enviarLinkResetSenha(endereco, token);
        } catch (RuntimeException e) {
            // Catch deliberado, e a excecao NAO sobe: deixar o 500 vazar reabriria a
            // enumeracao (500 para quem tem conta, 204 para quem nao tem). Loga em
            // ERROR para a falha de SMTP aparecer no monitoramento em vez de sumir.
            // E o unico ponto do projeto em que silenciar o erro para o cliente e a
            // resposta correta, e e por causa da regra de nao-enumerabilidade.
            log.error("falha ao enviar o link de reset; token gravado e nao entregue", e);
        }
    }

    @Transactional
    public void resetarSenha(String token, String novaSenha) {
        TokenResetSenha registro = tokensReset.findByTokenHash(hashDe(token))
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Token de reset invalido"));
        if (!registro.utilizavelEm(Instant.now())) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Token de reset expirado ou ja usado");
        }
        Usuario usuario = usuarios.findById(registro.getUsuarioId())
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Token de reset invalido"));
        usuario.trocarSenha(senhas.encode(novaSenha));
        registro.consumir(Instant.now());
        usuarios.save(usuario);
        tokensReset.save(registro);
    }

    /**
     * O turmaId sai daqui e nao do TurmaScopeResolver de proposito: o resolver
     * estoura 404 para quem nao tem vinculo, e aqui NAO ter turma e resposta
     * legitima — e o estado de todo mundo que acabou de se cadastrar.
     */
    private AuthResponse resposta(Usuario usuario) {
        UUID turmaId = membros.findByUsuarioIdOrderByEntrouEmDesc(usuario.getId()).stream()
                .findFirst()
                .map(Membro::getTurmaId)
                .orElse(null);
        return new AuthResponse(jwt.emitir(usuario.getId(), usuario.getNome()),
                UsuarioDto.de(usuario), turmaId);
    }

    /**
     * SHA-256 e nao BCrypt: BCrypt e salgado, entao nao daria para achar a linha
     * pelo hash. O token e um UUID aleatorio, nao uma senha escolhida por gente,
     * entao nao ha ataque de dicionario a atrapalhar.
     */
    private String hashDe(String token) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 ausente nesta JVM", e);
        }
    }
}
