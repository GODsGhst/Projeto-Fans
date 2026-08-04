package com.projetofans.repo;

import com.projetofans.domain.RegistroTipo;
import com.projetofans.domain.Revisao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevisaoRepository extends JpaRepository<Revisao, UUID> {

    List<Revisao> findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo tipo, UUID registroId);

    long countByRegistroTipoAndRegistroId(RegistroTipo tipo, UUID registroId);
}
