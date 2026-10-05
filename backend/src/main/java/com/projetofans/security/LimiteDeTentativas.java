package com.projetofans.security;

import com.projetofans.erro.ErroDeNegocio;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Teto de tentativas por chave, em janela fixa. Fecha a forca bruta que a
 * auditoria de 05/10/2026 apontou fora das cinco categorias: senha no login,
 * e-mail no "esqueci a senha" e codigo de convite (8 hex, 32 bits) ao entrar na
 * turma. As tres regras moram aqui, e nao espalhadas pelos controllers.
 *
 * A chave do login e do reset e o E-MAIL, nao o IP: atras do proxy do Render o
 * IP do cliente vem de X-Forwarded-For, que o cliente tambem escreve. O 429 sai
 * igual para e-mail com e sem conta, entao nao reabre a enumeracao.
 *
 * ponytail: memoria de uma instancia so — o free tier roda uma. Com replicas,
 * cada uma conta sozinha e o contador vai para o banco. Sem teto por IP, entao
 * "uma senha contra muitas contas" passa; com ~30 contas por turma, aceitavel.
 */
@Component
public class LimiteDeTentativas {

    /** Acima disto as janelas vencidas sao varridas; se nao bastar, zera tudo. */
    static final int MAXIMO_DE_CHAVES = 10_000;

    private record Janela(Instant fim, int tentativas) {
    }

    private final Map<String, Janela> janelas = new ConcurrentHashMap<>();
    private final Clock relogio;

    public LimiteDeTentativas() {
        this(Clock.systemUTC());
    }

    LimiteDeTentativas(Clock relogio) {
        this.relogio = relogio;
    }

    /** Uma pessoa nao erra a propria senha dez vezes em quinze minutos. */
    public void login(String email) {
        contar("login:" + normalizado(email), 10, Duration.ofMinutes(15));
    }

    /** Tambem impede usar o app para encher a caixa de alguem de e-mail de reset. */
    public void esqueciSenha(String email) {
        contar("esqueci:" + normalizado(email), 5, Duration.ofHours(1));
    }

    /** Por usuario, porque a rota ja exige login. Quem entra de verdade acerta em uma ou duas. */
    public void entrarNaTurma(UUID usuarioId) {
        contar("convite:" + usuarioId, 10, Duration.ofMinutes(15));
    }

    void contar(String chave, int maximo, Duration duracao) {
        Instant agora = relogio.instant();
        if (janelas.size() > MAXIMO_DE_CHAVES) {
            janelas.values().removeIf(j -> !agora.isBefore(j.fim()));
            if (janelas.size() > MAXIMO_DE_CHAVES) {
                // ponytail: inundacao de chaves distintas zera os contadores em vez
                // de estourar a memoria do free tier. Custa ao atacante dez mil
                // pedidos para ganhar mais `maximo` tentativas.
                janelas.clear();
            }
        }
        Janela atual = janelas.compute(chave, (k, j) -> j == null || !agora.isBefore(j.fim())
                ? new Janela(agora.plus(duracao), 1)
                : new Janela(j.fim(), j.tentativas() + 1));
        if (atual.tentativas() > maximo) {
            throw new ErroDeNegocio(HttpStatus.TOO_MANY_REQUESTS,
                    "Muitas tentativas. Espere alguns minutos e tente de novo.");
        }
    }

    /** So para o teste de inundacao. */
    int chavesGuardadas() {
        return janelas.size();
    }

    private static String normalizado(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
