package com.projetofans.service;

import com.projetofans.domain.AcaoRevisao;
import com.projetofans.domain.Materia;
import com.projetofans.domain.Material;
import com.projetofans.domain.RegistroTipo;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ConflitoVersaoException;
import com.projetofans.erro.NaoAutorException;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.repo.UsuarioRepository;
import com.projetofans.security.TurmaScopeResolver;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.AtualizarMaterialRequest;
import com.projetofans.web.dto.CriarMaterialRequest;
import com.projetofans.web.dto.MaterialResponse;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Material segue as mesmas regras de evento: autor-only, If-Match, exclusao
 * logica e revisao com o estado anterior. A repeticao e deliberada — sao duas
 * entidades diferentes com o mesmo contrato, e uma superclasse generica aqui
 * custaria mais para ler do que os poucos metodos que ela economizaria.
 *
 * O que NAO existe aqui: listagem por materia. Material chega pela tela da
 * materia ou pelos vinculos de um evento; um "liste tudo da materia" daria a
 * quem monta a tela de prova o caminho facil de despejar o semestre inteiro.
 */
@Service
public class MaterialService {

    private final MaterialRepository materiais;
    private final MateriaRepository materias;
    private final UsuarioRepository usuarios;
    private final RevisaoService revisoes;
    private final TurmaScopeResolver escopo;
    private final EntityManager em;

    public MaterialService(MaterialRepository materiais, MateriaRepository materias,
                           UsuarioRepository usuarios, RevisaoService revisoes,
                           TurmaScopeResolver escopo, EntityManager em) {
        this.materiais = materiais;
        this.materias = materias;
        this.usuarios = usuarios;
        this.revisoes = revisoes;
        this.escopo = escopo;
        this.em = em;
    }

    @Transactional
    public MaterialResponse criar(UsuarioAtual autor, CriarMaterialRequest req) {
        Materia materia = materiaDaTurmaDoUsuario(autor, req.materiaId());
        // arquivoRef fica nulo: envio de arquivo e a Task 15, e a constraint
        // material_tem_conteudo do banco exige que url exista neste MVP.
        Material material = new Material(UUID.randomUUID(), materia.getTurmaId(), materia.getId(),
                req.tipo(), req.titulo(), req.url(), req.dataAula(), autor.usuarioId(),
                Instant.now());
        // Mesmo detalhe do EventoService: save() e merge, e criado_em vem do banco.
        Material salvo = materiais.saveAndFlush(material);
        em.refresh(salvo);
        return MaterialResponse.de(salvo, autor.nome());
    }

    @Transactional
    public MaterialResponse atualizar(UsuarioAtual usuario, UUID materialId,
                                      int versionEsperada, AtualizarMaterialRequest req) {
        Material material = daTurmaDoUsuario(usuario, materialId);
        exigirAutor(usuario, material);
        exigirVersao(material, versionEsperada);
        Materia materia = materiaDaTurmaDoUsuario(usuario, req.materiaId());

        revisoes.registrar(RegistroTipo.MATERIAL, material.getId(), usuario.usuarioId(),
                AcaoRevisao.EDITAR, material);

        material.editar(materia.getId(), req.tipo(), req.titulo(), req.url(), Instant.now());
        Material salvo = materiais.saveAndFlush(material);
        return MaterialResponse.de(salvo, nomeDoAutor(salvo.getAutorId()));
    }

    @Transactional
    public void excluirLogicamente(UsuarioAtual usuario, UUID materialId, int versionEsperada) {
        Material material = daTurmaDoUsuario(usuario, materialId);
        exigirAutor(usuario, material);
        exigirVersao(material, versionEsperada);

        revisoes.registrar(RegistroTipo.MATERIAL, material.getId(), usuario.usuarioId(),
                AcaoRevisao.EXCLUIR, material);

        material.excluirLogicamente(Instant.now());
        materiais.saveAndFlush(material);
    }

    @Transactional(readOnly = true)
    public MaterialResponse buscar(UsuarioAtual usuario, UUID materialId) {
        Material material = daTurmaDoUsuario(usuario, materialId);
        return MaterialResponse.de(material, nomeDoAutor(material.getAutorId()));
    }

    private Material daTurmaDoUsuario(UsuarioAtual usuario, UUID materialId) {
        Material material = materiais.findById(materialId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), material.getTurmaId());
        return material;
    }

    private Materia materiaDaTurmaDoUsuario(UsuarioAtual usuario, UUID materiaId) {
        Materia materia = materias.findById(materiaId).orElseThrow(AcessoNegadoException::new);
        escopo.exigirMesmaTurma(usuario.usuarioId(), materia.getTurmaId());
        return materia;
    }

    private static void exigirAutor(UsuarioAtual usuario, Material material) {
        if (!material.getAutorId().equals(usuario.usuarioId())) {
            throw new NaoAutorException();
        }
    }

    private static void exigirVersao(Material material, int versionEsperada) {
        if (material.getVersion() != versionEsperada) {
            throw new ConflitoVersaoException(versionEsperada, material.getVersion());
        }
    }

    private String nomeDoAutor(UUID autorId) {
        return usuarios.findById(autorId).orElseThrow(AcessoNegadoException::new).getNome();
    }
}
