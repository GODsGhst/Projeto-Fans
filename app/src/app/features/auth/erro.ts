import { ErroApi } from '../../core/http-error.interceptor';

/**
 * Mensagem para a tela. O interceptor central ja traduziu cada status numa frase
 * pronta — senha errada, e-mail em uso, codigo invalido e falta de rede chegam
 * aqui com textos diferentes. Nenhuma tela le `status` cru nem inventa texto.
 *
 * O fallback existe para o que nao passou pelo interceptor (um `TypeError`, por
 * exemplo). Ele nunca engole: sempre sobra frase na tela.
 */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroApi) {
    return e.message;
  }
  return 'Não deu para completar a ação. Tente de novo.';
}
