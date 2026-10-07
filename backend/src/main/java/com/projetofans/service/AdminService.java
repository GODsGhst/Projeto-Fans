package com.projetofans.service;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.DocenteStatus;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.DocenteAdminResponse;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * O alcapao da plataforma. Dois poderes, e cada um existe por um motivo so.
 *
 * O PROBLEMA
 * A lideranca so se transfere pelas maos do lider. Quando o lider some — troca
 * de faculdade, formatura, desiste do app — a turma fica sem ninguem que possa
 * ocultar conteudo improprio ou passar o cargo adiante, para sempre. Nao ha
 * caminho de volta dentro do produto.
 *
 * O QUE O ADMIN PODE, E O QUE ELE NAO PODE
 * Pode: (1) definir quem e o lider de uma turma; (2) decidir quem e docente —
 * aprovar ou recusar a conta de professor/coordenador (spec 2026-10-06, emenda
 * a V6). Conta docente nasce PENDENTE e sem poder; o codigo de convite prova que
 * a pessoa e da turma, nao que ela da aula, entao quem atesta isso e o dono.
 * NAO pode: ler, criar, editar ou apagar conteudo de turma nenhuma. A fila
 * de docentes mostra CONTA (nome, e-mail, tipo), nunca turma. O poder e de
 * destravar e de atestar, nao de vigiar — um admin que le as provas e os
 * rascunhos de todo mundo e um problema maior que a turma travada que ele veio
 * resolver.
 *
 * COMO SE VIRA ADMIN
 * Por SQL, e so. Nenhuma rota escreve na coluna `admin_plataforma`, e a
 * entidade nao tem setter. Se existisse `POST /admin/promover`, ela seria o
 * alvo mais valioso da API: uma falha de autorizacao ali entregaria todas as
 * turmas de uma vez. Sem rota, virar admin exige acesso ao banco — outra
 * credencial, guardada em outro lugar, com rastro fora da aplicacao.
 *
 * Toda acao daqui deixa rastro. A troca de lider vai para o diario de moderacao;
 * a decisao docente fica na propria conta (decidido_por/em), porque o diario e por
 * turma e a aprovacao e da pessoa. Poder sem rastro e o comeco de "ninguem sabe
 * quem mudou isso".
 */
@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UsuarioRepository usuarios;
    private final MembroRepository membros;
    private final AcaoModeracaoRepository acoes;
    private final EntityManager em;

    public AdminService(UsuarioRepository usuarios, MembroRepository membros,
                        AcaoModeracaoRepository acoes, EntityManager em) {
        this.usuarios = usuarios;
        this.membros = membros;
        this.acoes = acoes;
        this.em = em;
    }

    /**
     * Poe alguem como lider da turma, e rebaixa quem estiver no cargo.
     *
     * O novo lider precisa JA SER MEMBRO. O admin destrava uma turma que
     * existe; ele nao coloca gente dentro dela — para entrar continua sendo
     * preciso o codigo de convite, que e de quem esta la dentro.
     */
    @Transactional
    public void definirLider(UsuarioAtual quemPede, UUID turmaId, UUID novoLiderUsuarioId) {
        exigirAdmin(quemPede);

        Membro novo = membros.findByUsuarioIdAndTurmaId(novoLiderUsuarioId, turmaId)
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.NOT_FOUND,
                        "Essa pessoa nao e membro dessa turma."));

        // Rebaixa o atual, se houver. `findByTurmaIdAndPapel` pode vir vazio: e
        // exatamente o caso que este metodo existe para consertar — a turma que
        // ficou sem lider porque a conta dele sumiu.
        membros.findByTurmaIdAndPapel(turmaId, PapelMembro.LIDER).ifPresent(atual -> {
            if (!atual.getUsuarioId().equals(novoLiderUsuarioId)) {
                atual.mudarPapel(PapelMembro.ALUNO);
                membros.saveAndFlush(atual);
            }
        });

        novo.mudarPapel(PapelMembro.LIDER);
        membros.saveAndFlush(novo);

        acoes.save(AcaoModeracao.transferenciaDeLideranca(
                UUID.randomUUID(), quemPede.usuarioId(), null));
        log.warn("admin {} definiu o lider da turma {}", quemPede.usuarioId(), turmaId);
    }

    /**
     * A fila de docentes, mais antiga primeiro (quem espera ha mais tempo no topo).
     * Sem filtro devolve todos os docentes; o filtro por status e o que a tela de
     * admin usa para separar "pendentes" de "aprovados" (que tambem pode revogar).
     *
     * Conta ALUNO nunca aparece: o CHECK do banco garante que so docente tem status,
     * e `in :alvo` nao casa com NULL. A lista de "todos os status" no lugar de um
     * `:status is null or ...` e de proposito: parametro nulo sem tipo no Postgres
     * estoura "nao deu para determinar o tipo do parametro".
     */
    @Transactional(readOnly = true)
    public List<DocenteAdminResponse> listarDocentes(UsuarioAtual quemPede, DocenteStatus status) {
        exigirAdmin(quemPede);
        List<DocenteStatus> alvo = status == null ? List.of(DocenteStatus.values()) : List.of(status);
        return em.createQuery(
                        "select u from Usuario u where u.docenteStatus in :alvo "
                                + "order by u.criadoEm, u.id", Usuario.class)
                .setParameter("alvo", alvo)
                .getResultList().stream()
                .map(DocenteAdminResponse::de)
                .toList();
    }

    @Transactional
    public void aprovarDocente(UsuarioAtual quemPede, UUID usuarioId) {
        decidirDocente(quemPede, usuarioId, true);
    }

    /** Serve tambem para REVOGAR um aprovado: o efeito e imediato (spec 7). */
    @Transactional
    public void recusarDocente(UsuarioAtual quemPede, UUID usuarioId) {
        decidirDocente(quemPede, usuarioId, false);
    }

    /**
     * Conta que nao existe e conta ALUNO dao o mesmo 404: para o recurso
     * /admin/docentes/{id}, aluno nao e docente — nao ha o que aprovar. Seria 409 se
     * o pedido fosse "aprovar ESTA conta", mas a rota nomeia um docente.
     *
     * O poder derivado do status e lido do banco a cada requisicao (nao vai no JWT),
     * entao recusar corta o poder do docente na proxima chamada dele, sem novo login.
     */
    private void decidirDocente(UsuarioAtual quemPede, UUID usuarioId, boolean aprovado) {
        exigirAdmin(quemPede);
        Usuario docente = usuarios.findById(usuarioId)
                .filter(u -> u.getTipoConta().ehDocente())
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.NOT_FOUND, "Nao encontrado"));
        docente.decidirDocente(aprovado, quemPede.usuarioId(), Instant.now());
        usuarios.save(docente);
        log.warn("admin {} {} o docente {}", quemPede.usuarioId(),
                aprovado ? "aprovou" : "recusou", usuarioId);
    }

    /**
     * 404, e nao 403, para quem nao e admin.
     *
     * Um 403 confirmaria que a rota de admin existe e que ela esta ali. Para
     * quem nao e admin, ela simplesmente nao existe — e e o mesmo raciocinio do
     * `AcessoNegadoException` no resto do projeto.
     */
    private void exigirAdmin(UsuarioAtual quemPede) {
        Usuario usuario = usuarios.findById(quemPede.usuarioId())
                .orElseThrow(() -> new ErroDeNegocio(HttpStatus.NOT_FOUND, "Nao encontrado"));
        if (!usuario.isAdminPlataforma()) {
            log.warn("tentativa de usar rota de admin por {}", quemPede.usuarioId());
            throw new ErroDeNegocio(HttpStatus.NOT_FOUND, "Nao encontrado");
        }
    }
}
