package com.projetofans.service;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Paleta;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.CorForaDaPaletaException;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.erro.NaoLiderException;
import com.projetofans.erro.SiglaDuplicadaException;
import com.projetofans.repo.EventoRepository;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.CriarMateriaRequest;
import com.projetofans.web.dto.EventoResponse;
import com.projetofans.web.dto.MateriaDetalheResponse;
import com.projetofans.web.dto.MateriaResponse;
import com.projetofans.web.dto.MaterialResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Materias da turma, e a tela de uma materia.
 *
 * Qualquer membro cria materia — nao e privilegio do lider. E a A6, e ela segue
 * o nao-negociavel 9: quem posta e quem sabe, sem fila e sem aprovacao.
 *
 * turma_id nunca e filtrado a mao: quem responde qual e a turma do usuario e o
 * TurmaScopeResolver, e materia de outra turma responde 404 — nunca 403, que
 * confirmaria que ela existe.
 */
@Service
public class MateriaService {

    private final MateriaRepository materias;
    private final EventoRepository eventos;
    private final MaterialRepository materiais;
    private final UsuarioRepository usuarios;
    private final TurmaScopeResolver escopo;

    public MateriaService(MateriaRepository materias, EventoRepository eventos,
                          MaterialRepository materiais, UsuarioRepository usuarios,
                          TurmaScopeResolver escopo) {
        this.materias = materias;
        this.eventos = eventos;
        this.materiais = materiais;
        this.usuarios = usuarios;
        this.escopo = escopo;
    }

    @Transactional(readOnly = true)
    public List<MateriaResponse> listar(UsuarioAtual usuario) {
        UUID turmaId = escopo.turmaDoUsuario(usuario.usuarioId());
        return materias.findByTurmaIdOrderBySiglaAsc(turmaId).stream()
                .map(MateriaResponse::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public MateriaDetalheResponse detalhe(UsuarioAtual usuario, UUID materiaId) {
        Materia materia = daTurmaDoUsuario(usuario, materiaId);
        return new MateriaDetalheResponse(
                MateriaResponse.de(materia),
                materiaisPorTipo(materia, TipoMaterial.AULA),
                materiaisPorTipo(materia, TipoMaterial.ADICIONAL),
                eventos.visiveisDaMateria(materia.getId()).stream()
                        .map(e -> resposta(e, materia))
                        .toList());
    }

    @Transactional
    public MateriaResponse criar(UsuarioAtual autor, CriarMateriaRequest req) {
        UUID turmaId = escopo.turmaDoUsuario(autor.usuarioId());

        if (!Paleta.contem(req.corHex())) {
            throw new CorForaDaPaletaException(req.corHex());
        }
        // Checagem explicita antes do INSERT para o app receber 409 com mensagem
        // legivel, em vez de um 500 vindo da violacao de materia_sigla_unica_na_turma.
        // A constraint continua sendo a garantia real: ela pega a corrida entre
        // dois cadastros simultaneos, que esta checagem sozinha deixaria passar.
        if (materias.findByTurmaIdAndSigla(turmaId, req.sigla()).isPresent()) {
            throw new SiglaDuplicadaException(req.sigla());
        }

        // criado_em nao entra: tem DEFAULT no banco e e insertable=false na entidade.
        Materia materia = new Materia(UUID.randomUUID(), turmaId, req.nome(), req.sigla(),
                req.corHex().toUpperCase(), req.sala(), req.professor());
        return MateriaResponse.de(materias.saveAndFlush(materia));
    }

    /**
     * Corrige sigla, nome, cor, sala e professor. So o LIDER, por enquanto.
     *
     * A regra do produto e "quem criou OU o lider", mas `materia` nao guarda quem a
     * criou (sem `autor_id`) e dar essa coluna a ela e migration. Ate la vale o
     * lado que da para decidir sem inventar dado: o lider. Ninguem ganha poder que
     * nao devia — so falta o autor ganhar o que e dele.
     *
     * Ordem das checagens: escopo (404) -> poder (403) -> conteudo (400/409). Nao
     * ha `version` na materia, entao nao ha If-Match nem 428: duas pessoas
     * corrigindo a mesma materia ao mesmo tempo, vale a ultima. O corpo e o mesmo
     * do cadastro e o PATCH substitui tudo.
     */
    @Transactional
    public MateriaResponse atualizar(UsuarioAtual usuario, UUID materiaId,
                                     CriarMateriaRequest req) {
        Materia materia = daTurmaDoUsuario(usuario, materiaId);
        exigirLider(usuario);

        if (!Paleta.contem(req.corHex())) {
            throw new CorForaDaPaletaException(req.corHex());
        }
        // A sigla de OUTRA materia da turma conflita; a da propria nao — salvar sem
        // mexer na sigla nao pode dar 409 contra si mesmo.
        materias.findByTurmaIdAndSigla(materia.getTurmaId(), req.sigla())
                .filter(outra -> !outra.getId().equals(materia.getId()))
                .ifPresent(outra -> {
                    throw new SiglaDuplicadaException(req.sigla());
                });

        materia.editar(req.nome(), req.sigla(), req.corHex().toUpperCase(),
                req.sala(), req.professor());
        return MateriaResponse.de(materias.saveAndFlush(materia));
    }

    /**
     * Apaga a materia, e so se ela estiver VAZIA. So o LIDER (ver `atualizar`).
     *
     * Vazia quer dizer sem NENHUMA linha de evento ou material apontando para ela —
     * oculta ou excluida logicamente incluidas. E a mesma pergunta que a FK
     * `evento.materia_id` faz ao banco, so que respondida antes, com frase que o
     * app consegue mostrar, em vez de um 500. O custo: materia cujas provas todas
     * foram apagadas (exclusao e logica) continua com linhas e nao se apaga.
     */
    @Transactional
    public void excluir(UsuarioAtual usuario, UUID materiaId) {
        Materia materia = daTurmaDoUsuario(usuario, materiaId);
        exigirLider(usuario);

        if (eventos.existsByMateriaId(materia.getId())
                || materiais.existsByMateriaId(materia.getId())) {
            throw new ErroDeNegocio(HttpStatus.CONFLICT,
                    "Mova ou apague as provas e materiais antes");
        }
        materias.delete(materia);
        // Grava ja: se alguem criou evento ou material entre a checagem acima e aqui,
        // a FK estoura DENTRO deste metodo, onde o ProblemDetailHandler a traduz em
        // 409. Deixar para o commit empurraria o erro para fora do que o handler
        // reconhece com seguranca.
        materias.flush();
    }

    private void exigirLider(UsuarioAtual usuario) {
        if (escopo.papelDoUsuario(usuario.usuarioId()) != PapelMembro.LIDER) {
            throw new NaoLiderException();
        }
    }

    private List<MaterialResponse> materiaisPorTipo(Materia materia, TipoMaterial tipo) {
        return materiais.visiveisDaMateriaPorTipo(materia.getId(), tipo).stream()
                .map(m -> MaterialResponse.de(m, nomeDoAutor(m.getAutorId())))
                .toList();
    }

    private EventoResponse resposta(Evento evento, Materia materia) {
        return EventoResponse.de(evento, materia, nomeDoAutor(evento.getAutorId()));
    }

    private String nomeDoAutor(UUID autorId) {
        return usuarios.findById(autorId).orElseThrow(AcessoNegadoException::new).getNome();
    }

    private Materia daTurmaDoUsuario(UsuarioAtual usuario, UUID materiaId) {
        Materia materia = materias.findById(materiaId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), materia.getTurmaId());
        return materia;
    }
}
