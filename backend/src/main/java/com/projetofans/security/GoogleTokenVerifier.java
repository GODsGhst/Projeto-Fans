package com.projetofans.security;

/**
 * Fronteira com a lib do Google.
 *
 * Existe para que o resto do backend nunca importe o SDK: em teste entra o
 * FakeGoogleTokenVerifier e a Task 3 fecha sem projeto no Google Cloud.
 */
public interface GoogleTokenVerifier {

    /** @return sub, email e nome do token, ou lanca TokenInvalidoException. */
    GoogleIdentidade verificar(String idToken);
}
