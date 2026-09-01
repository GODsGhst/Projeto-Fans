package com.projetofans.notify;

import java.util.UUID;

/**
 * A UNICA porta de saida de push do backend. Nenhum service chama o SDK do
 * Firebase direto — e a excecao deliberada a "sem interface de uma implementacao
 * so", porque aqui ha duas de verdade: FCM em prod e as sem-conta fora dele.
 *
 * E por causa desta interface que a Task 8 fecha sem projeto no Firebase.
 *
 * Quem resolve os device tokens e a implementacao, nao o chamador: o service sabe
 * QUE algo mudou na turma, nunca em quais aparelhos isso vira push.
 */
public interface Notifier {

    /** Data-message para os aparelhos da turma, EXCETO o do autor. */
    void avisarMudancaNaTurma(UUID turmaId, UUID autorIdExcluido, PayloadSync payload);
}
