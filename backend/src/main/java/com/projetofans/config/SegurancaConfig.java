package com.projetofans.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configuracao de seguranca do scaffold.
 *
 * ATENCAO: neste estagio a API esta aberta. O filtro JWT e as regras por rota
 * entram na Task 3, junto com o TurmaScopeResolver. Deixar aberto aqui e deliberado
 * — trancar antes de existir emissao de token so tornaria o scaffold impossivel de
 * exercitar — mas NAO pode chegar a producao assim.
 */
@Configuration
public class SegurancaConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(reg -> reg.anyRequest().permitAll());
        return http.build();
    }
}
