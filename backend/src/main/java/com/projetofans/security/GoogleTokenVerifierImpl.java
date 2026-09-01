package com.projetofans.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.projetofans.erro.TokenInvalidoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * O unico arquivo do projeto que toca no SDK do Google.
 *
 * So em dev e prod, e a lista e explicita de proposito. Cada outro perfil tem o
 * seu substituto, e trocar isto por um "!alguma-coisa" faria um perfil novo cair
 * aqui por acidente — que foi exatamente o risco quando o perfil teste nasceu:
 * ele casava com !test e exigiria um OAuth Client ID que ninguem tem.
 *   test  -> FakeGoogleTokenVerifier (src/test)
 *   teste -> GoogleTokenVerifierDesligado, que recusa com mensagem clara
 * O client id vem de GOOGLE_OAUTH_CLIENT_ID; nada hardcoded.
 */
@Component
@Profile({"dev", "prod"})
public class GoogleTokenVerifierImpl implements GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifierImpl.class);

    private final GoogleIdTokenVerifier verificador;

    public GoogleTokenVerifierImpl(@Value("${app.google-oauth-client-id}") String clientId) {
        this.verificador = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(List.of(clientId))
                .build();
    }

    @Override
    public GoogleIdentidade verificar(String idToken) {
        GoogleIdToken token;
        try {
            token = verificador.verify(idToken);
        } catch (GeneralSecurityException | IOException e) {
            // Relanca traduzido, nunca engole: falha de rede aqui nao pode virar
            // "login invalido" silencioso nem lista vazia. A causa vai junto e o
            // ERROR fica no log porque, sem eles, uma indisponibilidade do Google
            // apareceria para todo mundo como "seu token e invalido" e ninguem
            // saberia distinguir de credencial errada de verdade.
            log.error("falha ao verificar o ID token do Google", e);
            throw new TokenInvalidoException("falha ao verificar o ID token do Google", e);
        }
        if (token == null) {
            throw new TokenInvalidoException("ID token do Google invalido");
        }
        GoogleIdToken.Payload dados = token.getPayload();
        String nome = dados.get("name") instanceof String texto ? texto : dados.getEmail();
        // getEmailVerified() e Boolean e pode vir null: Boolean.TRUE.equals trata
        // null como nao verificado, que e o lado seguro.
        return new GoogleIdentidade(dados.getSubject(), dados.getEmail(), nome,
                Boolean.TRUE.equals(dados.getEmailVerified()));
    }
}
