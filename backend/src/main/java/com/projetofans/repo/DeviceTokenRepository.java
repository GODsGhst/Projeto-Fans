package com.projetofans.repo;

import com.projetofans.domain.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByFcmToken(String fcmToken);

    /**
     * Aparelhos da turma EXCETO os do autor da mudanca — quem cadastrou ja sabe,
     * e receber push do proprio cadastro e ruido.
     */
    @Query("""
        select d from DeviceToken d
        where d.usuarioId <> :autorId
          and d.usuarioId in (select m.usuarioId from Membro m where m.turmaId = :turmaId)
        """)
    List<DeviceToken> daTurmaExcetoAutor(@Param("turmaId") UUID turmaId,
                                         @Param("autorId") UUID autorId);
}
