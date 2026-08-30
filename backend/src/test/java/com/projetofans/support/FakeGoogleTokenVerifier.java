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
        return new GoogleIdentidade(idToken, idToken + "@google.dev", "Conta " + idToken);
    }
}
