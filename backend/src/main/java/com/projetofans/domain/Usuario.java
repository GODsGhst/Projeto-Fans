package com.projetofans.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Identidade e vinculo com a turma sao coisas separadas de proposito: a conta se
 * cria livremente (Google OU e-mail+senha), mas entrar na sala exige o codigo de
 * convite, registrado em {@link Membro}.
 *
 * Consequencia: o codigo de convite e a fronteira de confianca, nao o provedor de
 * login. E por isso que nome autodeclarado nao e furo — so quem tem o codigo entra.
 */
@Entity
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

    protected Usuario() {
    }

    private Usuario(UUID id, String nome, String email, String senhaHash, String googleSub) {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.senhaHash = senhaHash;
        this.googleSub = googleSub;
    }

    public static Usuario comSenha(UUID id, String nome, String email, String senhaHash) {
        return new Usuario(id, nome, email, senhaHash, null);
    }

    public static Usuario doGoogle(UUID id, String nome, String email, String googleSub) {
        return new Usuario(id, nome, email, null, googleSub);
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

    public void trocarSenha(String novoHash) {
        this.senhaHash = novoHash;
    }

    /** Liga o login por Google numa conta que ja existia por e-mail+senha. */
    public void vincularGoogle(String googleSub) {
        this.googleSub = googleSub;
    }
}
