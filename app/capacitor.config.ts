import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Identidade do app no aparelho.
 *
 * `appId` e o package Android, e ele e o campo mais caro de mudar depois: Google
 * Sign-In e Firebase amarram credencial ao package, e a Play Store nao aceita
 * troca de package num app ja publicado — vira app novo, sem os instaladores.
 * Por isso ele sai do `io.ionic.starter` do scaffold ANTES de existir projeto
 * nativo, e nao depois.
 *
 * `com.projetofans.app` e o que a Secao 11 do spec ja definia. O nome de exibicao
 * ainda e provisorio (C1 em PERGUNTAS-ABERTAS): trocar o nome que aparece embaixo
 * do icone e cosmetico e pode esperar; trocar o package, nao.
 */
const config: CapacitorConfig = {
  appId: 'com.projetofans.app',
  appName: 'projetoFans',
  webDir: 'www',
};

export default config;
