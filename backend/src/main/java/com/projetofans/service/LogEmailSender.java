package com.projetofans.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

/**
 * Sem SMTP configurado, o link de reset vai para o console em vez do e-mail.
 * Quem decide e a presenca de spring.mail.host, nao o perfil: o site roda no
 * perfil `teste`, e amarrar o SMTP a `prod` deixava a recuperacao de senha
 * fora do ar para a turma inteira.
 *
 * E o que permite fechar a Task 3 sem conta de e-mail: o fluxo inteiro roda, o
 * token e real e da para copiar do log e usar no reset a mao.
 */
@Component
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
