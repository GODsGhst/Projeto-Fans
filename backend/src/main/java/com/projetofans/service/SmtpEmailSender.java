package com.projetofans.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** O mesmo contrato, por SMTP de tier gratuito. So em producao. */
@Component
@Profile("prod")
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender correio;
    private final String remetente;
    private final String urlBase;

    public SmtpEmailSender(JavaMailSender correio,
                           @Value("${spring.mail.username}") String remetente,
                           @Value("${app.reset-senha-url-base}") String urlBase) {
        this.correio = correio;
        this.remetente = remetente;
        this.urlBase = urlBase;
    }

    @Override
    public void enviarLinkResetSenha(String email, String token) {
        SimpleMailMessage mensagem = new SimpleMailMessage();
        mensagem.setFrom(remetente);
        mensagem.setTo(email);
        mensagem.setSubject("projetoFans — redefinir sua senha");
        mensagem.setText("Para escolher uma senha nova, abra: " + urlBase + "?token=" + token
                + "\n\nO link vale por 1 hora e so funciona uma vez."
                + "\nSe nao foi voce que pediu, ignore este e-mail.");
        // Falha de SMTP sobe: um "204" mentiroso deixaria o usuario esperando um
        // e-mail que nunca sai. O ProblemDetailHandler transforma em 500 visivel.
        correio.send(mensagem);
    }
}
