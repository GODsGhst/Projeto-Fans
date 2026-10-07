package com.projetofans.web.dto;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;

import java.time.Instant;
import java.util.UUID;

/**
 * Uma linha da fila do admin: a CONTA, nao a turma. O admin decide quem a pessoa
 * e; nao ve onde ela atua (a V6 proibe o admin de ler conteudo de turma).
 */
public record DocenteAdminResponse(UUID usuarioId, String nome, String email,
                                   TipoConta tipoConta, DocenteStatus docenteStatus, Instant criadoEm) {

    public static DocenteAdminResponse de(Usuario usuario) {
        return new DocenteAdminResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                usuario.getTipoConta(), usuario.getDocenteStatus(), usuario.getCriadoEm());
    }
}
