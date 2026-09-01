package com.projetofans.service;

import com.projetofans.domain.DeviceToken;
import com.projetofans.erro.TokenDeOutroDonoException;
import com.projetofans.repo.DeviceTokenRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.RegistrarDeviceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Onde o push vai parar. Registrado no login, removido no logout.
 *
 * O registro e um UPSERT pelo `fcm_token`, nao um insert: o FCM devolve o mesmo
 * token a cada abertura do app, e a coluna e UNIQUE. Inserir sempre estouraria a
 * constraint na segunda abertura, e checar antes de inserir e o que transforma
 * isso em operacao idempotente — o app pode chamar `POST /devices` toda vez que
 * subir sem pensar no assunto.
 *
 * O token tambem pode TROCAR de dono: um aparelho emprestado, ou duas pessoas na
 * mesma turma usando o mesmo celular. Por isso `renovar` regrava o `usuario_id` —
 * senao o colega passaria a receber push endereçado a quem usou o aparelho antes.
 */
@Service
public class DeviceService {

    private static final Logger log = LoggerFactory.getLogger(DeviceService.class);

    private final DeviceTokenRepository tokens;

    public DeviceService(DeviceTokenRepository tokens) {
        this.tokens = tokens;
    }

    /**
     * Registrar token que ja e de outra pessoa e RECUSADO.
     *
     * O metodo remover() logo abaixo checa dono, com o motivo escrito: sem a
     * checagem, qualquer autenticado calaria o push de qualquer pessoa mandando o
     * token dela. Registrar sem checar dava exatamente o mesmo poder por outra
     * porta — um POST com o token da vitima transferia a linha, e ela parava de
     * receber os avisos da propria turma.
     *
     * O caso legitimo (aparelho emprestado, ou outra pessoa entrando no mesmo
     * celular) continua coberto: o app manda DELETE /devices no logout, entao o
     * token fica livre antes do proximo login. Se chegar 409 aqui, e porque alguem
     * pulou o logout — e ai avisar e melhor que trocar o dono em silencio.
     */
    @Transactional
    public void registrar(UsuarioAtual usuario, RegistrarDeviceRequest req) {
        Instant agora = Instant.now();
        DeviceToken registro = tokens.findByFcmToken(req.fcmToken()).orElse(null);

        if (registro == null) {
            tokens.save(new DeviceToken(UUID.randomUUID(), usuario.usuarioId(),
                    req.fcmToken(), req.plataforma(), agora));
            return;
        }
        if (!registro.getUsuarioId().equals(usuario.usuarioId())) {
            log.warn("tentativa de registrar token de device que pertence a outro usuario");
            throw new TokenDeOutroDonoException();
        }
        registro.renovar(usuario.usuarioId(), req.plataforma(), agora);
        tokens.save(registro);
    }

    /**
     * So o dono remove o proprio token, e a rota responde igual nos dois casos.
     * Sem a checagem de dono, qualquer autenticado calaria o push de qualquer
     * pessoa mandando o token dela; e distinguir "nao existe" de "nao e seu" pelo
     * status entregaria de brinde se um token e valido.
     */
    @Transactional
    public void remover(UsuarioAtual usuario, String fcmToken) {
        tokens.findByFcmToken(fcmToken)
                .filter(d -> d.getUsuarioId().equals(usuario.usuarioId()))
                .ifPresent(tokens::delete);
    }
}
