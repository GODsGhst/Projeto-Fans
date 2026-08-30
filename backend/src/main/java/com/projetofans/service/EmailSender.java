package com.projetofans.service;

/**
 * Fronteira com o envio de e-mail. Suportar e-mail+senha obriga a ter recuperacao
 * de senha — sem ela o primeiro aluno trancado fora vira suporte manual.
 */
public interface EmailSender {

    void enviarLinkResetSenha(String email, String token);
}
