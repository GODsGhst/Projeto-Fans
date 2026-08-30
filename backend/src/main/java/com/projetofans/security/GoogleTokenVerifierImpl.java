package com.projetofans.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.projetofans.erro.TokenInvalidoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * O unico arquivo do projeto que toca no SDK do Google.
 *
 * Fora do perfil test, para que o FakeGoogleTokenVerifier ocupe o lugar sem
 * conflito de bean. O client id vem de GOOGLE_OAUTH_CLIENT_ID; nada hardcoded.
 */
@Component
@Profile("!test")
public class GoogleTokenVerifierImpl implements GoogleTokenVerifier {

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
            // "login invalido" silencioso nem lista vazia.
            throw new TokenInvalidoException("falha ao verificar o ID token do Google");
        }
        if (token == null) {
            throw new TokenInvalidoException("ID token do Google invalido");
        }
        GoogleIdToken.Payload dados = token.getPayload();
        String nome = dados.get("name") instanceof String texto ? texto : dados.getEmail();
        return new GoogleIdentidade(dados.getSubject(), dados.getEmail(), nome);
    }
}
