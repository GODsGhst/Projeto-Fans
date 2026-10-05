export const environment = {
  production: true,
  /** Trocado no build de producao pelo host real da API. */
  apiUrl: 'https://projetofans-api.onrender.com/api/v1',
  /**
   * O servidor sabe mandar e-mail de reset?
   *
   * Sim, desde que SMTP_HOST/SMTP_USER/SMTP_PASSWORD estejam no painel do
   * Render: o SmtpEmailSender liga pela presenca do SMTP_HOST, em qualquer
   * perfil. Se essas variaveis sumirem, volte esta flag para `false` — senao a
   * tela promete um e-mail que so vai para o log.
   */
  recuperacaoPorEmail: true,
};
