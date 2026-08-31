package com.projetofans.web.controller;

import com.projetofans.domain.RegistroTipo;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.ModeracaoService;
import com.projetofans.web.dto.MotivoRequest;
import com.projetofans.web.dto.TransferirLiderancaRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.UUID;

/**
 * As quatro acoes do lider.
 *
 * A transferencia de lideranca mora aqui, e nao no TurmaController, apesar da rota
 * ser /turmas/...: ela e uma acao de moderacao, sai registrada em `acao_moderacao`
 * junto das outras tres, e separa-la deixaria metade da regra do papel em outro
 * arquivo. A rota e a da Secao 6.2 do spec; o @RequestMapping fica na raiz da API
 * para acomodar os dois prefixos, como ja faz o QuadroController.
 *
 * Nenhum metodo devolve corpo: 200 vazio. O cliente ja sabe o que pediu, e o
 * registro atualizado chega pela proxima leitura da Home ou de Nao listados.
 */
@RestController
@RequestMapping("/api/v1")
public class ModeracaoController {

    private final ModeracaoService moderacao;

    public ModeracaoController(ModeracaoService moderacao) {
        this.moderacao = moderacao;
    }

    @PostMapping("/moderacao/{tipo}/{id}/ocultar")
    public void ocultar(@AuthenticationPrincipal UsuarioAtual eu,
                        @PathVariable String tipo,
                        @PathVariable UUID id,
                        @RequestBody(required = false) MotivoRequest pedido) {
        moderacao.ocultar(eu, registroTipo(tipo), id, motivo(pedido));
    }

    @PostMapping("/moderacao/{tipo}/{id}/reexibir")
    public void reexibir(@AuthenticationPrincipal UsuarioAtual eu,
                         @PathVariable String tipo,
                         @PathVariable UUID id) {
        moderacao.reexibir(eu, registroTipo(tipo), id);
    }

    @PostMapping("/moderacao/{tipo}/{id}/pedir-exclusao")
    public void pedirExclusao(@AuthenticationPrincipal UsuarioAtual eu,
                              @PathVariable String tipo,
                              @PathVariable UUID id,
                              @RequestBody(required = false) MotivoRequest pedido) {
        moderacao.pedirExclusao(eu, registroTipo(tipo), id, motivo(pedido));
    }

    @PostMapping("/turmas/lideranca/transferir")
    public void transferirLideranca(@AuthenticationPrincipal UsuarioAtual eu,
                                    @Valid @RequestBody TransferirLiderancaRequest pedido) {
        moderacao.transferirLideranca(eu, pedido.novoLiderUsuarioId());
    }

    /**
     * Aceita "evento" e "EVENTO": a rota do spec e escrita em minusculas e o enum
     * em maiusculas, e um 400 por causa de caixa seria ruido. Tipo desconhecido e
     * 400 de verdade — nao 404, que faria parecer que o registro e que sumiu.
     */
    private static RegistroTipo registroTipo(String tipo) {
        try {
            return RegistroTipo.valueOf(tipo.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST,
                    "Tipo de registro invalido: " + tipo, e);
        }
    }

    /** Motivo e opcional, e corpo ausente e um caso normal — nao um erro. */
    private static String motivo(MotivoRequest pedido) {
        return pedido == null ? null : pedido.motivo();
    }
}
