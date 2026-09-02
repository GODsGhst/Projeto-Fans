// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  /** Prefixo da API. O backend serve tudo sob /api/v1 (Secao 6 do spec). */
  apiUrl: 'http://localhost:8080/api/v1',
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
