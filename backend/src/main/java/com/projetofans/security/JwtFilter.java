package com.projetofans.security;

import com.projetofans.erro.TokenInvalidoException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Le o Bearer e popula o UsuarioAtual no contexto de seguranca.
 *
 * Token ruim NAO vira excecao aqui: o filtro roda antes do @ControllerAdvice, entao
 * lancar so produziria um 500 com stacktrace. Ele deixa a requisicao anonima e o
 * entry point responde 401 em ProblemDetail — que e o que o app espera para limpar
 * o token e voltar ao login. O motivo vai para o log em vez de sumir.
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtFilter.class);
    private static final String PREFIXO = "Bearer ";

    private final JwtService jwt;

    public JwtFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest requisicao,
                                    @NonNull HttpServletResponse resposta,
                                    @NonNull FilterChain corrente) throws ServletException, IOException {
        String cabecalho = requisicao.getHeader("Authorization");
        if (cabecalho != null && cabecalho.startsWith(PREFIXO)) {
            try {
                UsuarioAtual usuario = jwt.validar(cabecalho.substring(PREFIXO.length()));
                var autenticacao = new UsernamePasswordAuthenticationToken(usuario, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(autenticacao);
            } catch (TokenInvalidoException e) {
                log.debug("Bearer recusado em {} {}: {}",
                        requisicao.getMethod(), requisicao.getRequestURI(), e.getMessage());
            }
        }
        corrente.doFilter(requisicao, resposta);
    }
}
