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
                                   TipoConta tipoConta, DocenteStatus docenteStatus, Instant criadoEm,
                                   boolean emailVerificado) {

    public static DocenteAdminResponse de(Usuario usuario) {
        return new DocenteAdminResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                usuario.getTipoConta(), usuario.getDocenteStatus(), usuario.getCriadoEm(),
                // Fixo em false DE PROPOSITO: nao existe verificacao de e-mail no cadastro
                // (qualquer um registra qualquer endereco), entao dizer true seria mentir
                // ao admin que decide por ele. O app mostra o aviso enquanto isto for false.
                // Quando houver o link por e-mail, o valor passa a vir da conta (A27).
                false);
    }
}
