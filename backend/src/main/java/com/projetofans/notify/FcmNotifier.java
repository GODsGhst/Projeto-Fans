package com.projetofans.notify;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MulticastMessage;
import com.projetofans.domain.DeviceToken;
import com.projetofans.repo.DeviceTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/**
 * O UNICO arquivo do projeto que toca no SDK do Firebase. Todo o resto depende da
 * interface {@link Notifier} — e e por isso que a Task 8 fecha sem projeto no
 * Firebase: fora de `prod` quem responde e o NotifierDeLog ou o FakeNotifier.
 *
 * A mensagem e DATA-ONLY, sem bloco `notification`. Isso e a decisao 2.3 e nao
 * detalhe de implementacao: um bloco de notificacao faria o Android desenhar o
 * aviso na hora do cadastro, e o aviso que a pessoa precisa ver e o da vespera as
 * 19h, agendado localmente. Data-message acorda o app para sincronizar e
 * REAGENDAR; quem desenha a notificacao e o aparelho.
 *
 * Falha de envio NAO derruba a escrita. Quem chega aqui ja persistiu o evento, e
 * transformar "o FCM esta fora do ar" em "nao consegui cadastrar sua prova" seria
 * trocar um atraso de sync por perda de dado. O sync de foreground cobre depois.
 * Nao e catch vazio: o erro sai no log com stacktrace.
 */
@Component
@Profile("prod")
public class FcmNotifier implements Notifier {

    private static final Logger log = LoggerFactory.getLogger(FcmNotifier.class);

    private final DeviceTokenRepository tokens;
    private final FirebaseMessaging fcm;

    public FcmNotifier(DeviceTokenRepository tokens,
                       @Value("${app.fcm-service-account-json}") String contaDeServico)
            throws IOException {
        this.tokens = tokens;
        FirebaseOptions opcoes = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(
                        new ByteArrayInputStream(contaDeServico.getBytes(StandardCharsets.UTF_8))))
                .build();
        FirebaseApp app = FirebaseApp.getApps().isEmpty()
                ? FirebaseApp.initializeApp(opcoes)
                : FirebaseApp.getInstance();
        this.fcm = FirebaseMessaging.getInstance(app);
    }

    @Override
    public void avisarMudancaNaTurma(UUID turmaId, UUID autorIdExcluido, PayloadSync payload) {
        List<String> destinos = tokens.daTurmaExcetoAutor(turmaId, autorIdExcluido).stream()
                .map(DeviceToken::getFcmToken)
                .toList();
        if (destinos.isEmpty()) {
            return;
        }
        try {
            // ponytail: um multicast so, e o FCM aceita ate 500 tokens por chamada.
            // Uma turma tem dezenas de aparelhos. Se um dia passar disso, particione
            // a lista aqui — nao vale fila nem lote antes de existir o problema.
            fcm.sendEachForMulticast(MulticastMessage.builder()
                    .putData("tipo", payload.tipo())
                    .putData("desde", payload.desde().toString())
                    .addAllTokens(destinos)
                    .build());
        } catch (FirebaseMessagingException e) {
            log.warn("push nao entregue para a turma {} ({} aparelhos); o sync de foreground cobre",
                    turmaId, destinos.size(), e);
        }
    }
}
