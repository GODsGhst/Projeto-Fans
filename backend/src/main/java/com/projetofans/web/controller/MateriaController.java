package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.MateriaService;
import com.projetofans.web.dto.CriarMateriaRequest;
import com.projetofans.web.dto.MateriaDetalheResponse;
import com.projetofans.web.dto.MateriaResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * As materias da turma, e a tela de uma materia.
 *
 * Alimenta a aba Materias e a tela que ela abre. Nenhuma tarefa do plano criou
 * este controller — a Task 11 fez o wiring das duas telas contra o contrato da
 * Secao 6.2 do spec e descobriu que o backend nao tinha o outro lado.
 */
@RestController
@RequestMapping("/api/v1/materias")
public class MateriaController {

    private final MateriaService materias;

    public MateriaController(MateriaService materias) {
        this.materias = materias;
    }

    @GetMapping
    public List<MateriaResponse> listar(@AuthenticationPrincipal UsuarioAtual usuario) {
        return materias.listar(usuario);
    }

    @GetMapping("/{id}")
    public MateriaDetalheResponse detalhe(@AuthenticationPrincipal UsuarioAtual usuario,
                                          @PathVariable UUID id) {
        return materias.detalhe(usuario, id);
    }

    /**
     * Corrige a materia. O corpo e o do cadastro e o PATCH substitui tudo. Sem
     * If-Match: `materia` nao tem coluna `version`.
     */
    @PatchMapping("/{id}")
    public MateriaResponse atualizar(@AuthenticationPrincipal UsuarioAtual usuario,
                                     @PathVariable UUID id,
                                     @Valid @RequestBody CriarMateriaRequest req) {
        return materias.atualizar(usuario, id, req);
    }

    /** So materia vazia. Com prova ou material, 409. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@AuthenticationPrincipal UsuarioAtual usuario, @PathVariable UUID id) {
        materias.excluir(usuario, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MateriaResponse criar(@AuthenticationPrincipal UsuarioAtual usuario,
                                 @Valid @RequestBody CriarMateriaRequest req) {
        return materias.criar(usuario, req);
    }
}
