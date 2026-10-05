export const environment = {
  production: true,
  /** Trocado no build de producao pelo host real da API. */
  apiUrl: 'https://projetofans-api.onrender.com/api/v1',
  /**
   * O servidor sabe mandar e-mail de reset?
   *
   * Sim, desde que SMTP_HOST/SMTP_USER/SMTP_PASSWORD estejam no painel do
   * Render: o SmtpEmailSender liga pela presenca do SMTP_HOST, em qualquer
   * perfil. Se essas variaveis sumirem a API recusa subir: o perfil hospedado
   * nao cai mais no LogEmailSender, porque o token de reset no log do Render e a
   * conta de qualquer pessoa (achado A1 da auditoria de 05/10/2026).
   */
  recuperacaoPorEmail: true,
};
