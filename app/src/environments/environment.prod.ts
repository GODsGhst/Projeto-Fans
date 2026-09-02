export const environment = {
  production: true,
  /** Trocado no build de producao pelo host real da API. */
  apiUrl: 'https://projetofans-api.onrender.com/api/v1',
  /**
   * O servidor sabe mandar e-mail de reset?
   *
   * `false` porque o deploy roda com `SPRING_PROFILES_ACTIVE=teste`
   * (backend/Dockerfile:32) e o `SmtpEmailSender` e `@Profile("prod")`. No
   * perfil `teste` quem atende e o `LogEmailSender`, que so escreve o link no
   * log do Render — ninguem recebe nada.
   *
   * Com a flag em `false` a tela de recuperar diz isso em vez de prometer um
   * e-mail que nao vem. Ligue quando houver SMTP de verdade configurado; a tela
   * volta sozinha ao texto normal.
   */
  recuperacaoPorEmail: false,
};
