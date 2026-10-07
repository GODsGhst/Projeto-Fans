package com.projetofans.web.dto;

import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.TipoConta;
import com.projetofans.domain.Usuario;

import java.util.UUID;

/**
 * O usuario como ele sai pela API. Nao tem senhaHash nem googleSub, e e essa a
 * razao de existir: entidade JPA nunca cruza a fronteira do controller, senao um
 * dia uma serializacao automatica leva o hash junto.
 *
 * `tipoConta` decide a interface (painel de docente ou app de aluno) logo apos o
 * login; `docenteStatus` e nulo para aluno (o jackson omite). O PODER do docente
 * nao sai daqui: o servidor confere o status no banco a cada requisicao.
 */
public record UsuarioDto(UUID id, String nome, String email,
                         TipoConta tipoConta, DocenteStatus docenteStatus) {

    public static UsuarioDto de(Usuario usuario) {
        return new UsuarioDto(usuario.getId(), usuario.getNome(), usuario.getEmail(),
                usuario.getTipoConta(), usuario.getDocenteStatus());
    }
}
