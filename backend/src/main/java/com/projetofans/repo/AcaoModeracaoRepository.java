package com.projetofans.repo;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.RegistroTipo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AcaoModeracaoRepository extends JpaRepository<AcaoModeracao, UUID> {

    List<AcaoModeracao> findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo tipo, UUID registroId);
}
