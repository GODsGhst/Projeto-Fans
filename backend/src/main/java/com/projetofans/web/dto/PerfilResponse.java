package com.projetofans.web.dto;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;

import java.util.UUID;

/**
 * A tela de perfil. Diferente do UsuarioDto porque precisa de duas coisas que o
 * login nao precisa: `adminPlataforma` e `temSenha`.
 *
 * `temSenha` e um booleano e nao o hash por razao obvia; ele existe para o app
 * esconder "trocar senha" de quem so entra pelo Google, em vez de mostrar um
 * formulario que sempre responderia 400.
 *
 * `tipoConta`/`docenteStatus` deixam o app (re)montar a interface certa ao reabrir
 * com o token guardado, e mostrar "aguardando aprovacao" ao docente pendente.
 */
public record PerfilResponse(UUID id, String nome, String email, boolean adminPlataforma, boolean temSenha,
                             TipoConta tipoConta, DocenteStatus docenteStatus) {

    public static PerfilResponse de(Usuario usuario) {
        return new PerfilResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                usuario.isAdminPlataforma(), usuario.getSenhaHash() != null,
                usuario.getTipoConta(), usuario.getDocenteStatus());
    }
}
