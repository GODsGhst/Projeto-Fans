package com.projetofans.service;

import com.projetofans.domain.Evento;
import com.projetofans.domain.Material;
import com.projetofans.erro.AcessoNegadoException;
import com.projetofans.erro.ErroDeNegocio;
import com.projetofans.repo.MaterialRepository;
import com.projetofans.security.UsuarioAtual;
import com.projetofans.web.dto.MaterialResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Envio de arquivo para uma prova ou entrega (apostila de upload).
 *
 * O arquivo vira um material da turma, com autor e hora como qualquer outro
 * (nao-negociavel 1), ja vinculado ao evento: a tela da prova mostra so o que
 * foi vinculado a ela (nao-negociavel 11).
 *
 * O servidor nao confia no que o cliente declara. A extensao do nome tem de
 * estar na lista E bater com os primeiros bytes do conteudo; o Content-Type da
 * parte multipart e ignorado. Um .exe renomeado para .pdf para no "%PDF".
 */
@Service
public class ArquivoService {

    /** Mesmo teto do app; o spring.servlet.multipart barra antes o que passar muito disso. */
    public static final int TETO_BYTES = 5 * 1024 * 1024;
    static final int TETO_TITULO = 120;

    private static final Map<String, String> MIME_POR_EXTENSAO = Map.of(
            "pdf", "application/pdf",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg");

    /** 100 MB por turma e 300 MB no servidor; o resto do 0,5 GB fica para os dados. */
    long cotaTurmaBytes = 100L * 1024 * 1024;
    long cotaServidorBytes = 300L * 1024 * 1024;

    private final JdbcTemplate jdbc;
    private final EventoService eventos;
    private final MaterialService materiais;
    private final MaterialRepository materialRepo;

    public ArquivoService(JdbcTemplate jdbc, EventoService eventos, MaterialService materiais,
                          MaterialRepository materialRepo) {
        this.jdbc = jdbc;
        this.eventos = eventos;
        this.materiais = materiais;
        this.materialRepo = materialRepo;
    }

    public record Baixado(String nome, String mime, byte[] conteudo) {
    }

    @Transactional
    public MaterialResponse enviarParaEvento(UsuarioAtual eu, UUID eventoId, MultipartFile arquivo,
                                             String descricao) {
        // Escopo antes de tudo: evento de outra turma e 404 mesmo com arquivo invalido.
        Evento evento = eventos.daTurmaDoUsuario(eu, eventoId);

        String nome = nomeLimpo(arquivo.getOriginalFilename());
        byte[] conteudo = bytes(arquivo);
        if (conteudo.length == 0) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "O arquivo esta vazio.");
        }
        if (conteudo.length > TETO_BYTES) {
            throw new ErroDeNegocio(HttpStatus.PAYLOAD_TOO_LARGE, "O arquivo passa de 5 MB.");
        }
        String mime = mimeConferido(nome, conteudo);
        String titulo = descricao == null || descricao.isBlank() ? nome : descricao.trim();
        if (titulo.codePointCount(0, titulo.length()) > TETO_TITULO) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "A descricao passa de 120 caracteres.");
        }

        exigirEspaco(evento.getTurmaId(), conteudo.length);

        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO arquivo (id, turma_id, nome, mime, tamanho_bytes, conteudo, autor_id)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, evento.getTurmaId(), nome, mime, conteudo.length, conteudo, eu.usuarioId());
        MaterialResponse material = materiais.criarDeArquivo(eu, evento.getMateriaId(), titulo,
                id.toString());
        eventos.vincularMaterial(eu, eventoId, material.id());
        return material;
    }

    /**
     * O arquivo vale o que vale o material dele: de outra turma, oculto pelo lider ou
     * excluido e 404 (o autor ainda ve o proprio, como no material). Sem isto, quem
     * guardou o id baixava o arquivo que o lider tirou da turma. A regra e checada
     * antes de o conteudo sair do banco.
     */
    @Transactional(readOnly = true)
    public Baixado baixar(UsuarioAtual eu, UUID arquivoId) {
        Material material = materialRepo.findByArquivoRef(arquivoId.toString())
                .orElseThrow(AcessoNegadoException::new);
        materiais.daTurmaDoUsuario(eu, material.getId());
        List<Baixado> achados = jdbc.query(
                "SELECT nome, mime, conteudo FROM arquivo WHERE id = ?",
                (rs, i) -> new Baixado(rs.getString("nome"), rs.getString("mime"), rs.getBytes("conteudo")),
                arquivoId);
        if (achados.isEmpty()) {
            throw new AcessoNegadoException();
        }
        return achados.get(0);
    }

    /**
     * O banco e um so para todas as turmas (Neon gratuito, 0,5 GB para tudo). Sem cota,
     * uma conta criada na hora enchia o banco e as escritas paravam para todo mundo.
     */
    private void exigirEspaco(UUID turmaId, int tamanho) {
        // ponytail: dois envios ao mesmo tempo podem passar juntos da cota por ate um arquivo cada.
        long daTurma = jdbc.queryForObject(
                "SELECT COALESCE(SUM(tamanho_bytes), 0) FROM arquivo WHERE turma_id = ?", Long.class, turmaId);
        long doServidor = jdbc.queryForObject(
                "SELECT COALESCE(SUM(tamanho_bytes), 0) FROM arquivo", Long.class);
        if (daTurma + tamanho > cotaTurmaBytes || doServidor + tamanho > cotaServidorBytes) {
            throw new ErroDeNegocio(HttpStatus.INSUFFICIENT_STORAGE,
                    "Acabou o espaco para arquivos. Fale com o lider da turma.");
        }
    }

    /** Tira caminho e caractere de controle; o nome so serve para exibir. */
    static String nomeLimpo(String original) {
        String nome = original == null ? "" : original;
        nome = nome.substring(Math.max(nome.lastIndexOf('/'), nome.lastIndexOf('\\')) + 1);
        nome = nome.replaceAll("\\p{Cntrl}", "").trim();
        if (nome.isEmpty()) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "O arquivo veio sem nome.");
        }
        return nome.length() > TETO_TITULO ? nome.substring(nome.length() - TETO_TITULO) : nome;
    }

    static String mimeConferido(String nome, byte[] conteudo) {
        int ponto = nome.lastIndexOf('.');
        String extensao = ponto < 0 ? "" : nome.substring(ponto + 1).toLowerCase(Locale.ROOT);
        String mime = MIME_POR_EXTENSAO.get(extensao);
        if (mime == null || !comecaCom(conteudo, assinatura(mime))) {
            throw new ErroDeNegocio(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Envie um PDF, PNG ou JPG de verdade.");
        }
        return mime;
    }

    private static byte[] assinatura(String mime) {
        return switch (mime) {
            case "application/pdf" -> new byte[] {'%', 'P', 'D', 'F', '-'};
            case "image/png" -> new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
            default -> new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        };
    }

    private static boolean comecaCom(byte[] conteudo, byte[] prefixo) {
        return conteudo.length >= prefixo.length
                && Arrays.equals(conteudo, 0, prefixo.length, prefixo, 0, prefixo.length);
    }

    private static byte[] bytes(MultipartFile arquivo) {
        try {
            return arquivo.getBytes();
        } catch (IOException e) {
            throw new ErroDeNegocio(HttpStatus.BAD_REQUEST, "Nao foi possivel ler o arquivo.", e);
        }
    }
}
