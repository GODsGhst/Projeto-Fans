// Tipos de valor dos componentes visuais (espelha app/src/app/shared/tipos.ts).
// Nao importa data/: os componentes recebem valores simples, e quem chama converte.

/// Prova pesa mais que entrega, por tinta. A cor fica para a materia.
enum TipoEvento { prova, entrega }

/// Anotacao da turma e anotacao pessoal nunca podem se parecer.
enum AlcanceNota { turma, pessoal }

/// "Esta pessoa tem poder aqui". Nome TipoSelo porque Selo e o widget.
enum TipoSelo { professor, coordenacao }

/// Par indivisivel cor + sigla, como `Materia` em tipos.ts. Nome MateriaVisual porque Materia
/// e o modelo de data/models.dart. Formato igual ao `materia` do EventoVm: `{sigla, cor}`.
typedef MateriaVisual = ({String sigla, String cor});
