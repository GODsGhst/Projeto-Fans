package com.projetofans.security;

import com.projetofans.erro.TokenInvalidoException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Login por Google desligado, para o ambiente de teste hospedado.
 *
 * O {@link GoogleTokenVerifierImpl} precisa de um OAuth Client ID de verdade, e o
 * ponto do perfil {@code teste} e subir a API com UMA conta so — a do Postgres.
 * Exigir projeto no Google Cloud antes de um colega conseguir abrir o app
 * transformaria "manda o APK para alguem testar" numa tarde de configuracao.
 *
 * Ele recusa em vez de fingir que funciona. Um verificador que aceitasse qualquer
 * token seria um buraco de autenticacao com aparencia de conveniencia — e este
 * perfil roda na internet aberta, nao na maquina de quem desenvolve.
 *
 * A mensagem e explicita para que quem testar entenda que e ambiente, nao bug. Na
 * tela, o botao do Google ja aparece desabilitado pelo mesmo motivo.
 */
@Component
@Profile("teste")
public class GoogleTokenVerifierDesligado implements GoogleTokenVerifier {

    @Override
    public GoogleIdentidade verificar(String idToken) {
        throw new TokenInvalidoException(
                "Entrar com Google não está ativo neste ambiente. Use e-mail e senha.");
    }
}
