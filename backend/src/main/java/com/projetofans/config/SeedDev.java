package com.projetofans.config;

import com.projetofans.domain.Materia;
import com.projetofans.domain.Membro;
import com.projetofans.domain.PapelMembro;
import com.projetofans.domain.Turma;
import com.projetofans.domain.Usuario;
import com.projetofans.repo.MateriaRepository;
import com.projetofans.repo.MembroRepository;
import com.projetofans.repo.TurmaRepository;
import com.projetofans.repo.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Seed de desenvolvimento. Componente Java, e nao migration SQL, por um motivo
 * concreto: os usuarios de exemplo precisam de senha_hash BCrypt valido, e SQL nao
 * computa hash — em migration eu teria de colar um literal e torcer para conferir.
 *
 * Roda so no perfil dev. O perfil test NAO carrega isto de proposito: linhas de
 * exemplo poluiriam as assercoes ("esperava 6 eventos, vieram 9").
 *
 * Cria DOIS membros, um LIDER e um ALUNO. Ambos sao necessarios: sem LIDER os
 * endpoints de moderacao ficam impossiveis de exercitar a mao, e sem ALUNO os
 * casos de 403 ficam impossiveis.
 */
@Component
@Profile("dev")
public class SeedDev implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDev.class);

    private static final String CODIGO_CONVITE = "TURMA01";
    private static final String SENHA_PADRAO = "senha123";

    private final TurmaRepository turmas;
    private final UsuarioRepository usuarios;
    private final MembroRepository membros;
    private final MateriaRepository materias;
    private final PasswordEncoder encoder;

    public SeedDev(TurmaRepository turmas, UsuarioRepository usuarios,
                   MembroRepository membros, MateriaRepository materias,
                   PasswordEncoder encoder) {
        this.turmas = turmas;
        this.usuarios = usuarios;
        this.membros = membros;
        this.materias = materias;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (turmas.findByCodigoConvite(CODIGO_CONVITE).isPresent()) {
            log.info("Seed dev ja aplicado, pulando.");
            return;
        }

        Turma turma = turmas.save(new Turma(
            UUID.randomUUID(), "Analise e Desenvolvimento de Sistemas — 4o periodo",
            "2026.2", CODIGO_CONVITE));

        String hash = encoder.encode(SENHA_PADRAO);

        Usuario lider = usuarios.save(Usuario.comSenha(
            UUID.randomUUID(), "Ana Beatriz", "ana@exemplo.dev", hash));
        Usuario aluno = usuarios.save(Usuario.comSenha(
            UUID.randomUUID(), "Otavio", "otavio@exemplo.dev", hash));

        membros.save(new Membro(UUID.randomUUID(), lider.getId(), turma.getId(), PapelMembro.LIDER));
        membros.save(new Membro(UUID.randomUUID(), aluno.getId(), turma.getId(), PapelMembro.ALUNO));

        // Cores da paleta validada — ver docs/design/design-system-v1.html
        materias.saveAll(List.of(
            new Materia(UUID.randomUUID(), turma.getId(), "Calculo II", "CALC2", "#1D4ED8"),
            new Materia(UUID.randomUUID(), turma.getId(), "Banco de Dados", "BD", "#0369A1"),
            new Materia(UUID.randomUUID(), turma.getId(), "Engenharia de Software", "ESOFT", "#0F766E"),
            new Materia(UUID.randomUUID(), turma.getId(), "Redes de Computadores", "REDES", "#15803D")
        ));

        log.info("Seed dev aplicado. Codigo de convite: {} | logins: {} e {} | senha: {}",
            CODIGO_CONVITE, lider.getEmail(), aluno.getEmail(), SENHA_PADRAO);
    }
}
