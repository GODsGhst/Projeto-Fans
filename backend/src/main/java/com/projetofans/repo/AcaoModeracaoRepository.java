package com.projetofans.repo;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.AcaoModeracaoTipo;
import com.projetofans.domain.RegistroTipo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AcaoModeracaoRepository extends JpaRepository<AcaoModeracao, UUID> {

    List<AcaoModeracao> findByRegistroTipoAndRegistroIdOrderByEmDesc(RegistroTipo tipo, UUID registroId);

    /**
     * Acoes de um tipo sobre uma lista de registros.
     *
     * A tabela guarda `registro_tipo` + `registro_id` e NAO o autor do registro —
     * de proposito, porque ela e o diario da moderacao, nao um indice de posse.
     * Quem quer "os pedidos sobre o que e meu" descobre primeiro o que e seu e
     * pergunta por esses ids.
     */
    @Query("""
            SELECT a FROM AcaoModeracao a
            WHERE a.acao = :acao AND a.registroTipo = :tipo AND a.registroId IN :ids
            ORDER BY a.em DESC
            """)
    List<AcaoModeracao> doTipoSobre(@Param("acao") AcaoModeracaoTipo acao,
                                    @Param("tipo") RegistroTipo tipo,
                                    @Param("ids") Collection<UUID> ids);
}
