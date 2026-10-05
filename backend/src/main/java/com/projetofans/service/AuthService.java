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
import com.projetofans.web.dto.PerfilAtualizadoResponse;
import com.projetofans.web.dto.PerfilResponse;
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
        String nomeLimpo = nomeValido(nome);
        if (usuarios.existsByEmail(endereco)) {
            // 409, e nao 400: o pedido esta bem formado, o estado do servidor e que conflita.
            throw new ErroDeNegocio(HttpStatus.CONFLICT, "Ja existe conta com este e-mail");
        }
        Usuario novo = usuarios.save(Usuario.comSenha(
                UUID.randomUUID(), nomeLimpo, endereco, hashDaSenha(senha)));
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
        usuario.trocarSenha(hashDaSenha(novaSenha));
        registro.consumir(Instant.now());
        usuarios.save(usuario);
        tokensReset.save(registro);
    }

    @Transactional(readOnly = true)
    public PerfilResponse perfil(UUID usuarioId) {
        return PerfilResponse.de(dono(usuarioId));
    }

    /**
     * Devolve JWT novo porque o atual carrega o nome. A limpeza e aqui e nao so no
     * @NotBlank: "  Ana  " passaria na validacao e iria com espacos para a autoria
     * de tudo que a pessoa posta. Ver nomeValido.
     */
    @Transactional
    public PerfilAtualizadoResponse renomear(UUID usuarioId, String nome) {
        Usuario usuario = dono(usuarioId);
        usuario.renomear(nomeValido(nome));
        usuarios.save(usuario);
        return new PerfilAtualizadoResponse(jwt.emitir(usuario.getId(), usuario.getNome()),
                PerfilResponse.de(usuario));
    }

    /**
     * Senha atual errada e 400, NUNCA 401: o interceptor do app trata 401 como
     * sessao expirada e desloga — errar a senha atual jogaria a pessoa no login.
     * Aqui ela ja esta autenticada; o erro e do formulario, nao da sessao.
     */
    /**
     * Devolve um JWT novo: o token carrega a versao da senha (JwtService), entao
     * trocar a senha derruba TODA sessao emitida antes — inclusive a de quem esta
     * trocando. Os outros aparelhos saem, que e o objetivo; quem trocou continua
     * logado com o token devolvido aqui.
     */
    @Transactional
    public String trocarSenha(UUID usuarioId, String senhaAtual, String novaSenha) {
        Usuario usuario = dono(usuarioId);
        if (usuario.getSenhaHash() == null) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Esta conta entra pelo Google e nao tem senha");
        }
        if (!senhas.matches(senhaAtual, usuario.getSenhaHash())) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Senha atual incorreta");
        }
        usuario.trocarSenha(hashDaSenha(novaSenha));
        usuarios.saveAndFlush(usuario);
        return jwt.emitir(usuario.getId(), usuario.getNome());
    }

    /**
     * Unica porta para virar senha em hash — cadastro, reset e troca passam aqui.
     * O BCrypt so le 72 BYTES, e o spring-security-crypto 6.5 passou a lancar
     * IllegalArgumentException acima disso em vez de truncar: sem esta guarda, o
     * @Size(max = 100) dos pedidos deixava passar senha que estourava 500. Conta em
     * bytes UTF-8, nao em caracteres, porque acento e emoji ocupam mais de um.
     * O login nao precisa dela: matches() acima de 72 bytes so devolve false.
     */
    private String hashDaSenha(String senha) {
        if (senha.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Senha muito longa: use no maximo 72 caracteres");
        }
        return senhas.encode(senha);
    }

    /**
     * strip() e nao trim(): trim, como o @NotBlank, so corta ate U+0020, e um nome
     * so de NBSP ou U+3000 passava nos dois e virava autoria invisivel. Nem strip()
     * tira NBSP ou U+200B (nao sao "whitespace" para o Java), por isso quem decide
     * e exigir ao menos uma letra ou digito. Cadastro e renomear usam a mesma regra.
     */
    private String nomeValido(String nome) {
        String limpo = nome.strip();
        if (limpo.codePoints().noneMatch(Character::isLetterOrDigit)) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Nome precisa ter ao menos uma letra ou numero");
        }
        return limpo;
    }

    /**
     * JWT valido de conta que nao existe mais: 401, porque a sessao e que esta
     * morta — e e o 401 que faz o app limpar o token e voltar ao login.
     */
    private Usuario dono(UUID usuarioId) {
        return usuarios.findById(usuarioId)
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.UNAUTHORIZED, "Sessao invalida"));
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
