package com.projetofans.web.dto;

import java.time.Instant;
import java.util.List;

/**
 * Delta de `GET /sync?desde=`. Alimenta o reagendador local do app.
 *
 * `eventosAlterados` inclui os OCULTOS e os EXCLUIDOS — o oposto do resto da API,
 * de proposito. Em toda outra rota registro oculto some; aqui ele precisa
 * aparecer, porque e assim que o aparelho sabe DESAGENDAR a notificacao da
 * vespera. Quem filtrar visibilidade aqui quebra a funcionalidade inteira em
 * silencio: a Home fica certa e o celular continua avisando de uma prova que a
 * turma nao ve mais. `visivelTurma` e `excluidoEm` viajam em cada item para o app
 * distinguir "mudou" de "sumiu".
 *
 * `materias` vem inteira, nao em delta: sao poucas linhas por turma, nao ha
 * timestamp de alteracao nelas, e sem sigla e cor o app nao consegue desenhar o
 * evento novo que acabou de receber.
 *
 * `servidorEm` e o relogio DO SERVIDOR, e e o que o app guarda como `ultimoSync`.
 * Usar o relogio do aparelho aqui perderia toda mudanca feita na diferenca entre
 * os dois.
 */
public record SyncResponse(
        List<EventoResponse> eventosAlterados,
        List<MateriaResponse> materias,
        Instant servidorEm) {
}
