package com.projetofans.web.dto;

import com.projetofans.domain.RegistroTipo;

import java.time.Instant;
import java.util.UUID;

/**
 * Um registro que o lider ocultou e que continua oculto — a lista dele para
 * achar de volta o que escondeu.
 *
 * Sem esta lista, "reexibir" so existia para quem ainda estava na tela do
 * registro logo apos ocultar: ao sair dela o lider levava 404 e nao havia
 * caminho de volta, embora o servidor guardasse tudo.
 *
 * `titulo` vem pronto porque anotacao nao tem titulo — para ela sai o comeco do
 * texto. `ocultadoEm` e ausente quando nao ha linha em `acao_moderacao` (o
 * registro foi escondido por fora do fluxo normal), e a tela trata ausente como
 * "sem data", nunca como "agora".
 */
public record OcultadoResponse(
        RegistroTipo registroTipo,
        UUID registroId,
        String titulo,
        UUID autorId,
        String autorNome,
        Instant ocultadoEm) {
}
