package com.projetofans.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.projetofans.domain.AcaoRevisao;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.Revisao;
import com.projetofans.repo.RevisaoRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * O historico append-only da regra 2: editar nao apaga o que havia antes.
 *
 * Chamado SEMPRE antes de aplicar a mudanca, com o estado anterior. O estado
 * posterior nao vai para ca porque ele ja esta na propria linha do registro —
 * guardar os dois duplicaria dado e criaria duas versoes da verdade.
 */
@Service
public class RevisaoService {

    private final RevisaoRepository revisoes;
    private final ObjectMapper json;

    public RevisaoService(RevisaoRepository revisoes, ObjectMapper json) {
        this.revisoes = revisoes;
        this.json = json;
    }

    public void registrar(RegistroTipo registroTipo, UUID registroId, UUID autorId,
                          AcaoRevisao acao, Object snapshotAnterior) {
        revisoes.save(new Revisao(UUID.randomUUID(), registroTipo, registroId,
                autorId, acao, serializar(snapshotAnterior)));
    }

    /**
     * Falhar aqui aborta a edicao inteira, de proposito. Gravar a mudanca sem
     * conseguir gravar o historico e a unica coisa que a regra 2 proibe de forma
     * absoluta — melhor o usuario ver um erro e tentar de novo.
     */
    private String serializar(Object snapshotAnterior) {
        try {
            return json.writeValueAsString(snapshotAnterior);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Nao foi possivel serializar o snapshot da revisao", e);
        }
    }
}
