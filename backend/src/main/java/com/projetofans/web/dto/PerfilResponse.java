package com.projetofans.web.dto;

import com.projetofans.domain.Usuario;

import java.util.UUID;

/**
 * A tela de perfil. Diferente do UsuarioDto porque precisa de duas coisas que o
 * login nao precisa: `adminPlataforma` e `temSenha`.
 *
 * `temSenha` e um booleano e nao o hash por razao obvia; ele existe para o app
 * esconder "trocar senha" de quem so entra pelo Google, em vez de mostrar um
 * formulario que sempre responderia 400.
 */
public record PerfilResponse(UUID id, String nome, String email, boolean adminPlataforma, boolean temSenha) {

    public static PerfilResponse de(Usuario usuario) {
        return new PerfilResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                usuario.isAdminPlataforma(), usuario.getSenhaHash() != null);
    }
}
