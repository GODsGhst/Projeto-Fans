package com.projetofans.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.projetofans.service.EmailSender;
import com.projetofans.service.LogEmailSender;
import com.projetofans.service.SmtpEmailSender;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * Quem manda o link de reset e decidido pelo SMTP_HOST, nao pelo perfil. O site
 * roda em `teste`; quando o SMTP era preso a `prod`, a recuperacao de senha so
 * escrevia no log e ninguem recebia e-mail.
 */
class EscolhaDoEmailSenderTest {

    private final ApplicationContextRunner contexto = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
            .withUserConfiguration(LogEmailSender.class, SmtpEmailSender.class)
            .withPropertyValues("app.reset-senha-url-base=https://site/senha/reset");

    @Test
    void semSmtpOLinkVaiParaOLog() {
        contexto.withPropertyValues("spring.mail.host=")
                .run(c -> assertThat(c.getBean(EmailSender.class)).isInstanceOf(LogEmailSender.class));
    }

    @Test
    void comSmtpOEmailSaiDeVerdade() {
        contexto.withPropertyValues("spring.mail.host=smtp.gmail.com", "spring.mail.username=a@b.c")
                .run(c -> assertThat(c.getBean(EmailSender.class)).isInstanceOf(SmtpEmailSender.class));
    }
}
