package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.util.UUID;

/**
 * Identidade e vinculo com a turma sao coisas separadas de proposito: a conta se
 * cria livremente (Google OU e-mail+senha), mas entrar na sala exige o codigo de
 * convite, registrado em {@link Membro}.
 *
 * Consequencia: o codigo de convite e a fronteira de confianca, nao o provedor de
 * login. E por isso que nome autodeclarado nao e furo — so quem tem o codigo entra.
 *
 * {@code @DynamicUpdate} porque usuario nao tem coluna version e o Hibernate, por
 * padrao, grava a linha inteira no UPDATE. Um renomear concorrente com uma troca de
 * senha regravaria o senha_hash ANTIGO que leu antes — a senha nova sumiria sem
 * erro. Gravando so a coluna que mudou, as duas edicoes nao se pisam.
 */
@Entity
@DynamicUpdate
@Table(name = "usuario")
public class Usuario {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    /** NULL quando a conta veio do Google. */
    @Column(name = "senha_hash")
    private String senhaHash;

    /** NULL quando a conta veio de e-mail+senha. */
    @Column(name = "google_sub", unique = true)
    private String googleSub;

    @Column(name = "criado_em", nullable = false, insertable = false, updatable = false)
    private Instant criadoEm;

    /**
     * Admin de plataforma. Concedido SOMENTE por SQL.
     *
     * Nao ha setter, e a ausencia e a decisao: sem caminho no codigo, nao ha
     * rota que possa ser enganada para promover alguem. Virar admin exige
     * acesso ao banco, que e outra credencial, guardada em outro lugar.
     *
     * `updatable = false` para que nem um `save()` distraido consiga mexer.
     */
    @Column(name = "admin_plataforma", nullable = false, insertable = false, updatable = false)
    private boolean adminPlataforma;

    /**
     * Interface da conta (aluno ou docente), escolhida UMA vez, no cadastro.
     * `updatable = false` pelo mesmo motivo do admin_plataforma: nenhum save()
     * distraido pode transformar aluno em professor. Quem muda o tipo e o dono,
     * por SQL (spec 3.3).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_conta", nullable = false, updatable = false)
    private TipoConta tipoConta;

    /**
     * NULL para ALUNO; PENDENTE/APROVADO/RECUSADO para docente (CHECK no banco).
     * Sem setter: muda so por {@link #decidirDocente}, que as rotas do admin chamam.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "docente_status")
    private DocenteStatus docenteStatus;

    @Column(name = "docente_decidido_por")
    private UUID docenteDecididoPor;

    @Column(name = "docente_decidido_em")
    private Instant docenteDecididoEm;

    protected Usuario() {
    }

    private Usuario(UUID id, String nome, String email, String senhaHash, String googleSub,
                    TipoConta tipoConta) {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.senhaHash = senhaHash;
        this.googleSub = googleSub;
        this.tipoConta = tipoConta;
        // Docente nasce PENDENTE (spec 2.1); aluno nao tem status. O CHECK do banco
        // exige exatamente isso, entao nascer errado nem chega a gravar.
        this.docenteStatus = tipoConta.ehDocente() ? DocenteStatus.PENDENTE : null;
    }

    public static Usuario comSenha(UUID id, String nome, String email, String senhaHash) {
        return comSenha(id, nome, email, senhaHash, TipoConta.ALUNO);
    }

    /** Cadastro por e-mail+senha: unico caminho que aceita um tipo de conta (spec 8). */
    public static Usuario comSenha(UUID id, String nome, String email, String senhaHash,
                                   TipoConta tipoConta) {
        return new Usuario(id, nome, email, senhaHash, null, tipoConta);
    }

    /** Conta criada direto pelo Google e sempre ALUNO; o admin corrige por SQL se precisar. */
    public static Usuario doGoogle(UUID id, String nome, String email, String googleSub) {
        return new Usuario(id, nome, email, null, googleSub, TipoConta.ALUNO);
    }

    public UUID getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getEmail() {
        return email;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public String getGoogleSub() {
        return googleSub;
    }

    public boolean isAdminPlataforma() {
        return adminPlataforma;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public TipoConta getTipoConta() {
        return tipoConta;
    }

    public DocenteStatus getDocenteStatus() {
        return docenteStatus;
    }

    public UUID getDocenteDecididoPor() {
        return docenteDecididoPor;
    }

    public Instant getDocenteDecididoEm() {
        return docenteDecididoEm;
    }

    /**
     * Unico caminho que escreve o status docente. Vale tambem para revogar um
     * aprovado (aprovado=false vira RECUSADO) e para reaprovar um recusado.
     * Grava quem decidiu e quando: e o rastro da decisao do admin.
     */
    public void decidirDocente(boolean aprovado, UUID adminId, Instant agora) {
        if (!tipoConta.ehDocente()) {
            // O CHECK do banco recusaria de qualquer jeito; falhar aqui da a causa.
            throw new IllegalStateException("Conta ALUNO nao passa por aprovacao docente");
        }
        this.docenteStatus = aprovado ? DocenteStatus.APROVADO : DocenteStatus.RECUSADO;
        this.docenteDecididoPor = adminId;
        this.docenteDecididoEm = agora;
    }

    public void trocarSenha(String novoHash) {
        this.senhaHash = novoHash;
    }

    /** Nome autodeclarado, como no cadastro: quem garante a turma e o convite, nao o nome. */
    public void renomear(String nome) {
        this.nome = nome;
    }

    /** Liga o login por Google numa conta que ja existia por e-mail+senha. */
    public void vincularGoogle(String googleSub) {
        this.googleSub = googleSub;
    }
}
