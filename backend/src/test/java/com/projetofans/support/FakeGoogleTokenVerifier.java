package com.projetofans.support;

import com.projetofans.erro.TokenInvalidoException;
import com.projetofans.security.GoogleIdentidade;
import com.projetofans.security.GoogleTokenVerifier;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Substitui a lib do Google no perfil test.
 *
 * E por causa desta classe que a Task 3 fecha sem projeto no Google Cloud: o
 * backend depende da INTERFACE GoogleTokenVerifier, nunca da lib, e o unico lugar
 * que toca no SDK de verdade e o GoogleTokenVerifierImpl, que so existe fora de test.
 *
 * Convencao: o idToken E o google sub. Assim o teste "reusa usuario na segunda vez"
 * so precisa mandar a mesma string duas vezes, sem fixture nenhuma.
 *
 * Para os casos que precisam escolher o e-mail e a claim email_verified, o token
 * aceita a forma "sub|email|verificado". Sem as partes extras, o e-mail e derivado
 * do sub e a identidade vem verificada — que e o caminho feliz.
 */
@Component
@Profile("test")
public class FakeGoogleTokenVerifier implements GoogleTokenVerifier {

    public static final String TOKEN_INVALIDO = "token-invalido";

    @Override
    public GoogleIdentidade verificar(String idToken) {
        if (idToken == null || idToken.isBlank() || TOKEN_INVALIDO.equals(idToken)) {
            throw new TokenInvalidoException("ID token do Google invalido");
        }
        String[] partes = idToken.split("\\|");
        String sub = partes[0];
        String email = partes.length > 1 ? partes[1] : sub + "@google.dev";
        boolean verificado = partes.length <= 2 || Boolean.parseBoolean(partes[2]);
        return new GoogleIdentidade(sub, email, "Conta " + sub, verificado);
    }
}
