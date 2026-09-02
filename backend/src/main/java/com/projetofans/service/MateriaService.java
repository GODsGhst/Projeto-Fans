package com.projetofans.service;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Paleta;
import com.projetofans.domain.TipoMaterial;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.CorForaDaPaletaException;
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
