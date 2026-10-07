package com.projetofans.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.security.JwtFilter;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.security.config.Customizer;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.List;

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

    /**
     * De onde o app pode chamar a API.
     *
     * Lista explicita, nunca "*". Com origem coringa o navegador recusa enviar
     * credencial, e mesmo que aceitasse, qualquer pagina da internet poderia
     * disparar chamadas autenticadas contra esta API a partir do navegador de
     * quem estiver logado.
     *
     * As origens do Capacitor sao estranhas de proposito: o app empacotado nao
     * roda em `https://projetofans.com`, ele roda num WebView que serve os
     * arquivos locais sob um esquema proprio. No Android e `https://localhost`;
     * no iOS, `capacitor://localhost`. Sao literais, nao exemplos.
     *
     * `http://localhost:8100` e o `ionic serve` de quem desenvolve.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            // A versao web do app mora num dominio de verdade, e ele so se sabe
            // depois que o site existe. Vem de CORS_ORIGENS (lista separada por
            // virgula, origem exata) em vez de literal aqui. Vazio por padrao:
            // sem a variavel, a lista e exatamente a de antes.
            @Value("${app.cors-origens-extras:}") List<String> origensExtras) {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origens = new ArrayList<>(List.of(
                "https://localhost",      // Capacitor Android
                "capacitor://localhost",  // Capacitor iOS
                "http://localhost",       // WebView em configuracao antiga
                "http://localhost:8100")); // ionic serve
        origensExtras.stream().map(String::trim).filter(o -> !o.isEmpty()).forEach(origens::add);
        config.setAllowedOrigins(origens);
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"));
        // If-Match nao e header simples: sem ele aqui, todo PATCH e DELETE do app
        // morre no preflight, e so eles — um bug que aparece semanas depois,
        // quando alguem tenta editar. X-IA-Key idem: sem ele o resumo por IA
        // morria no preflight e o app dizia "Sem conexao". X-Turma-Id idem: e a turma
        // ativa do docente (spec 2.8); sem ele toda requisicao do docente no site
        // morre no preflight, e so as dele — o app do aluno nunca manda.
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "If-Match", "X-IA-Key", "X-Turma-Id"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
        fonte.registerCorsConfiguration("/api/**", config);
        return fonte;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtFilter jwtFilter,
                                           ObjectMapper json) throws Exception {
        http
            // Sem isto o app nao fala com a API, e falha do jeito mais confuso
            // possivel: o WebView manda o preflight OPTIONS por causa do header
            // Authorization, o Spring Security responde 401 (OPTIONS nao esta no
            // permitAll e nao ha token), o navegador bloqueia, e o app registra
            // "sem conexao" — indistinguivel de servidor fora do ar.
            //
            // O CorsFilter roda ANTES da autenticacao, entao o preflight e
            // respondido sem passar pelo JWT. E por isso que ligar o cors aqui
            // resolve sozinho, sem precisar liberar OPTIONS no permitAll.
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(reg -> reg
                .requestMatchers("/api/v1/auth/**").permitAll()
                // "a API esta no ar?" nao pode exigir conta. Nao expoe nada alem disso.
                .requestMatchers("/api/v1/saude").permitAll()
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
