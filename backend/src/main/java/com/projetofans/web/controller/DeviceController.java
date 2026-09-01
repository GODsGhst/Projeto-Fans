package com.projetofans.web.controller;

import com.projetofans.security.UsuarioAtual;
import com.projetofans.service.DeviceService;
import com.projetofans.web.dto.RegistrarDeviceRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Onde entregar o push. `POST` no login e a cada abertura do app (e idempotente),
 * `DELETE` no logout — sem ele, o aparelho de quem saiu continuaria acordando por
 * causa de uma turma que a pessoa nao acompanha mais.
 *
 * Nao ha `usuarioId` em lugar nenhum destas rotas: o dono do token e sempre o
 * autenticado.
 */
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceController {

    private final DeviceService devices;

    public DeviceController(DeviceService devices) {
        this.devices = devices;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void registrar(@AuthenticationPrincipal UsuarioAtual eu,
                          @Valid @RequestBody RegistrarDeviceRequest pedido) {
        devices.registrar(eu, pedido);
    }

    @DeleteMapping("/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@AuthenticationPrincipal UsuarioAtual eu, @PathVariable String token) {
        devices.remover(eu, token);
    }
}
