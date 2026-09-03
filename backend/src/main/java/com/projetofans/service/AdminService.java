package com.projetofans.service;

import com.projetofans.domain.AcaoModeracao;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Usuario;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.AcaoModeracaoRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.UsuarioAtual;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * O alcapao da plataforma. Um poder so, e ele existe por um motivo so.
 *
 * O PROBLEMA
 * A lideranca so se transfere pelas maos do lider. Quando o lider some — troca
 * de faculdade, formatura, desiste do app — a turma fica sem ninguem que possa
 * ocultar conteudo improprio ou passar o cargo adiante, para sempre. Nao ha
 * caminho de volta dentro do produto.
 *
 * O QUE O ADMIN PODE, E O QUE ELE NAO PODE
 * Pode: definir quem e o lider de uma turma. So isso.
 * NAO pode: ler, criar, editar ou apagar conteudo de turma nenhuma. O poder e
 * de destravar, nao de vigiar — um admin que le as provas e os rascunhos de
 * todo mundo e um problema maior que a turma travada que ele veio resolver.
 *
 * COMO SE VIRA ADMIN
 * Por SQL, e so. Nenhuma rota escreve na coluna `admin_plataforma`, e a
 * entidade nao tem setter. Se existisse `POST /admin/promover`, ela seria o
 * alvo mais valioso da API: uma falha de autorizacao ali entregaria todas as
 * turmas de uma vez. Sem rota, virar admin exige acesso ao banco — outra
 * credencial, guardada em outro lugar, com rastro fora da aplicacao.
 *
 * Toda acao daqui vai para o diario de moderacao. Poder sem rastro e o comeco
 * de "ninguem sabe quem mudou isso".
 */
@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UsuarioRepository usuarios;
    private final MembroRepository membros;
    private final AcaoModeracaoRepository acoes;

    public AdminService(UsuarioRepository usuarios, MembroRepository membros,
                        AcaoModeracaoRepository acoes) {
        this.usuarios = usuarios;
        this.membros = membros;
        this.acoes = acoes;
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
