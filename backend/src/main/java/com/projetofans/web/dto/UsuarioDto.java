package com.projetofans.web.dto;

import com.projetofans.domain.Usuario;

import java.util.UUID;

/**
 * O usuario como ele sai pela API. Nao tem senhaHash nem googleSub, e e essa a
 * razao de existir: entidade JPA nunca cruza a fronteira do controller, senao um
 * dia uma serializacao automatica leva o hash junto.
 */
public record UsuarioDto(UUID id, String nome, String email) {

    public static UsuarioDto de(Usuario usuario) {
        return new UsuarioDto(usuario.getId(), usuario.getNome(), usuario.getEmail());
    }
}
