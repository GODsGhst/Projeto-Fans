package com.projetofans.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.projetofans.ProjetoFansApplication;
import com.projetofans.service.EmailSender;
import com.projetofans.service.LogEmailSender;
import com.projetofans.service.SmtpEmailSender;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * Quem manda o link de reset e decidido pelo SMTP_HOST. O site roda em `teste`;
 * quando o SMTP era preso a `prod`, a recuperacao de senha so escrevia no log e
 * ninguem recebia e-mail.
 *
 * E o log so recebe o link na maquina de quem desenvolve: no ambiente hospedado
 * ele e lido pelo painel do Render, e o token ali e a conta de qualquer pessoa
 * (achado A1 da auditoria de 05/10/2026).
 */
class EscolhaDoEmailSenderTest {

    private final ApplicationContextRunner contexto = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
            .withUserConfiguration(LogEmailSender.class, SmtpEmailSender.class)
            .withPropertyValues("app.reset-senha-url-base=https://site/senha/reset");

    @Test
    void semSmtpEmDevOLinkVaiParaOLog() {
        contexto.withPropertyValues("spring.mail.host=", "spring.profiles.active=dev")
                .run(c -> assertThat(c.getBean(EmailSender.class)).isInstanceOf(LogEmailSender.class));
    }

    @Test
    void comSmtpOEmailSaiDeVerdade() {
        contexto.withPropertyValues("spring.mail.host=smtp.gmail.com", "spring.mail.username=a@b.c",
                        "spring.profiles.active=teste")
                .run(c -> assertThat(c.getBean(EmailSender.class)).isInstanceOf(SmtpEmailSender.class));
    }

    @Test
    void foraDeDevETestOLogNuncaRecebeOLink() {
        contexto.withPropertyValues("spring.mail.host=", "spring.profiles.active=teste")
                .run(c -> assertThat(c).doesNotHaveBean(LogEmailSender.class));
    }

    /**
     * O application.yml de verdade, no perfil que roda no Render: sem SMTP_HOST a
     * API nao sobe, em vez de subir mandando o token para o log. A falha vem antes
     * de qualquer conexao com o banco, por isso o DATABASE_URL pode ser falso.
     */
    @Test
    void perfilHospedadoSemSmtpHostNaoSobe() {
        SpringApplicationBuilder app = new SpringApplicationBuilder(ProjetoFansApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("teste")
                .properties("DATABASE_URL=jdbc:postgresql://127.0.0.1:1/nada",
                        "JWT_SECRET=Zk3v9QpX2mL7rT8wY1aB4cD6eF0gH5jK8nP3sU7xZ2q=");

        assertThatThrownBy(() -> app.run().close()).hasStackTraceContaining("SMTP_HOST");
    }
}
