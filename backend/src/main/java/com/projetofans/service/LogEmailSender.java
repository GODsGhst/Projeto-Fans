package com.projetofans.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fora de producao, o link de reset vai para o console em vez do SMTP.
 *
 * E o que permite fechar a Task 3 sem conta de e-mail: o fluxo inteiro roda, o
 * token e real e da para copiar do log e usar no reset a mao.
 */
@Component
@Profile("!prod")
public class LogEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);

    private final String urlBase;

    public LogEmailSender(@Value("${app.reset-senha-url-base}") String urlBase) {
        this.urlBase = urlBase;
    }

    @Override
    public void enviarLinkResetSenha(String email, String token) {
        log.info("[reset de senha] para {} -> {}?token={}", email, urlBase, token);
    }
}
