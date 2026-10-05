package com.projetofans.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Sem SMTP configurado, o link de reset vai para o console em vez do e-mail.
 * Quem decide entre ele e o SmtpEmailSender e a presenca de spring.mail.host.
 *
 * E o que permite fechar a Task 3 sem conta de e-mail: o fluxo inteiro roda, o
 * token e real e da para copiar do log e usar no reset a mao.
 *
 * So existe em dev e test, a maquina de quem desenvolve. O log de um ambiente
 * hospedado e lido por mais gente (painel do Render, log drain, print), e um
 * token de reset ali e a conta de qualquer um: basta pedir o reset do e-mail
 * da vitima e ler o log. Por isso `teste` e `prod` exigem SMTP_HOST para subir,
 * e este perfil fecha a porta mesmo que alguem devolva o default vazio.
 * Achado A1 da auditoria de 05/10/2026.
 */
@Component
@Profile({"dev", "test"})
@ConditionalOnExpression("'${spring.mail.host:}'.isEmpty()")
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
