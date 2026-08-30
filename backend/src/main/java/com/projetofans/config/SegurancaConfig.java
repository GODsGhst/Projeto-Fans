package com.projetofans.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.security.JwtFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * A API deixou de estar aberta na Task 3.
 *
 * So /api/v1/auth/** e publico — e a porta por onde se obtem o JWT. Todo o resto
 * exige Bearer valido, incluindo criar e entrar em turma.
 *
 * Sessao STATELESS: o app e um cliente movel com token, nao um navegador com
 * cookie. Por isso CSRF nao se aplica.
 */
@Configuration
public class SegurancaConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtFilter jwtFilter,
                                           ObjectMapper json) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(reg -> reg
                .requestMatchers("/api/v1/auth/**").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint(json)))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Sem isto o Spring responderia 403 a quem nem se identificou, e o app trata
     * 403 como "voce nao e o autor" — mensagem errada para quem so precisa entrar
     * de novo. Escrito a mao porque o filtro roda antes do @ControllerAdvice, e o
     * contrato de erro do projeto e ProblemDetail em toda resposta.
     */
    private AuthenticationEntryPoint entryPoint(ObjectMapper json) {
        return (requisicao, resposta, excecao) -> {
            ProblemDetail corpo = ProblemDetail.forStatusAndDetail(
                    HttpStatus.UNAUTHORIZED, "Autenticacao necessaria");
            resposta.setStatus(HttpStatus.UNAUTHORIZED.value());
            resposta.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            json.writeValue(resposta.getOutputStream(), corpo);
        };
    }
}
