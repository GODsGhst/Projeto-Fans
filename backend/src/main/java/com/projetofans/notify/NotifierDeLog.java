package com.projetofans.notify;

import com.projetofans.domain.DeviceToken;
import com.projetofans.repo.DeviceTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Push nos ambientes sem Firebase: dev na maquina de quem desenvolve e o perfil
 * `teste` hospedado.
 *
 * Ele imprime o que o {@link FcmNotifier} enviaria, pelo mesmo motivo do
 * LogEmailSender: fazer o caminho ser observavel sem exigir conta em serviço
 * externo. Nao finge sucesso de entrega — diz literalmente que nao enviou.
 *
 * A consequencia em dev e conhecida e aceita: o aparelho so descobre a mudanca no
 * proximo sync de foreground, login ou pull-to-refresh. O alerta da vespera nao
 * depende disto, porque ele e local (decisao 2.3).
 */
@Component
@Profile({"dev", "teste"})
public class NotifierDeLog implements Notifier {

    private static final Logger log = LoggerFactory.getLogger(NotifierDeLog.class);

    private final DeviceTokenRepository tokens;

    public NotifierDeLog(DeviceTokenRepository tokens) {
        this.tokens = tokens;
    }

    @Override
    public void avisarMudancaNaTurma(UUID turmaId, UUID autorIdExcluido, PayloadSync payload) {
        List<String> destinos = tokens.daTurmaExcetoAutor(turmaId, autorIdExcluido).stream()
                .map(DeviceToken::getFcmToken)
                .toList();
        log.info("[push nao enviado: sem FCM neste perfil] turma={} payload={} desde={} destinos={}",
                turmaId, payload.tipo(), payload.desde(), destinos);
    }
}
