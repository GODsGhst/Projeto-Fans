package com.projetofans.erro;

/**
 * 404 de quem nao tem vinculo com turma nenhuma — por exemplo, quem o lider removeu.
 *
 * Mesmo status e mesmo texto do {@link AcessoNegadoException} (e e uma delas, para
 * quem a captura): nada muda para quem de fora tenta adivinhar o que existe. So
 * leva o codigo SEM_TURMA, que diz apenas o que a propria pessoa ja sabe sobre si.
 * O app so apaga turma, lembretes e snapshot locais diante deste codigo; um 404
 * qualquer (proxy, portal cativo, registro que sumiu) nao pode ter esse poder.
 */
public class SemTurmaException extends AcessoNegadoException {

    public static final String CODIGO = "SEM_TURMA";

    @Override
    public String getCodigo() {
        return CODIGO;
    }
}
