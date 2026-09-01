package com.projetofans.support;

import com.projetofans.domain.DeviceToken;
import com.projetofans.notify.Notifier;
import com.projetofans.notify.PayloadSync;
import com.projetofans.repo.DeviceTokenRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Substitui o FCM no perfil test. E por causa dele que R20 e verificavel sem uma
 * conta no Firebase.
 *
 * Ele RESOLVE os tokens de verdade, pelo mesmo metodo de repository que o
 * FcmNotifier usa, e guarda quais teriam recebido o push. Guardar so a chamada
 * deixaria "o autor nao recebe o proprio cadastro" sem guarda nenhuma — a regra
 * mora na query, nao no service.
 *
 * O bean e singleton da JVM de teste: cada teste chama {@link #limpar()} antes.
 */
@Component
@Profile("test")
public class FakeNotifier implements Notifier {

    /** Uma notificacao que teria saido, com os tokens que teriam recebido. */
    public record Chamada(UUID turmaId, UUID autorExcluido, PayloadSync payload, List<String> tokens) {
    }

    private final DeviceTokenRepository tokens;
    private final List<Chamada> chamadas = new CopyOnWriteArrayList<>();

    public FakeNotifier(DeviceTokenRepository tokens) {
        this.tokens = tokens;
    }

    @Override
    public void avisarMudancaNaTurma(UUID turmaId, UUID autorIdExcluido, PayloadSync payload) {
        chamadas.add(new Chamada(turmaId, autorIdExcluido, payload,
                tokens.daTurmaExcetoAutor(turmaId, autorIdExcluido).stream()
                        .map(DeviceToken::getFcmToken)
                        .toList()));
    }

    public List<Chamada> chamadas() {
        return List.copyOf(chamadas);
    }

    public void limpar() {
        chamadas.clear();
    }
}
