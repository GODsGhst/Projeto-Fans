package com.projetofans.web.dto;

import com.projetofans.domain.TipoConta;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code tipoConta} e opcional: ausente = ALUNO, o que mantem o app de aluno
 * funcionando sem mudar uma linha. Docente nasce PENDENTE (spec 2.1), entao
 * declarar-se professor aqui nao da poder nenhum ate o admin aprovar.
 */
public record RegistrarRequest(
        @NotBlank @Size(max = 120) String nome,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 100) String senha,
        TipoConta tipoConta) {
}
