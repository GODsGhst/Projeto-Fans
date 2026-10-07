package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.DocenteService;
import com.projetofans.web.dto.LecionadasRequest;
import com.projetofans.web.dto.MinhaTurmaResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Declarar o que leciona e contestar quem declara (spec 7). Mora num controller
 * proprio, e nao no TurmaController, so para os dois nao disputarem o mesmo
 * arquivo — o prefixo e o mesmo de proposito: sao rotas da turma do usuario.
 *
 * As tres respostas sao a turma inteira (o mesmo corpo de GET /turmas/minha), com
 * o estado ja atualizado.
 */
@RestController
@RequestMapping("/api/v1/turmas/minha")
public class DocenteController {

    private final DocenteService docentes;

    public DocenteController(DocenteService docentes) {
        this.docentes = docentes;
    }

    /** So o PROFESSOR da turma, e so para as materias dela. Substitui o conjunto. */
    @PutMapping("/lecionadas")
    public MinhaTurmaResponse declarar(@AuthenticationPrincipal UsuarioAtual eu,
                                       @Valid @RequestBody LecionadasRequest pedido) {
        return docentes.declarar(eu, pedido.materiaIds());
    }

    /** So o lider. O docente perde poder e selo nesta turma ate ser restaurado. */
    @PostMapping("/docentes/{usuarioId}/contestar")
    public MinhaTurmaResponse contestar(@AuthenticationPrincipal UsuarioAtual eu,
                                        @PathVariable UUID usuarioId) {
        return docentes.contestar(eu, usuarioId);
    }

    @PostMapping("/docentes/{usuarioId}/restaurar")
    public MinhaTurmaResponse restaurar(@AuthenticationPrincipal UsuarioAtual eu,
                                        @PathVariable UUID usuarioId) {
        return docentes.restaurar(eu, usuarioId);
    }
}
