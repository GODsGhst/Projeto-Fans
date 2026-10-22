// Port de app/src/app/features/material-vm.ts. O que a linha de material recebe.

import '../data/models.dart' as modelos;
import 'evento_vm.dart' show assinatura, meses, seloDoModelo;
import 'tipos.dart';

/// O que MaterialLinha precisa para desenhar uma linha da lista.
class MaterialVm {
  const MaterialVm({
    required this.url,
    required this.daAula,
    required this.autorId,
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.autoria,
    required this.temResumo,
    this.autoriaSelo,
    this.editadoPor,
    this.editadoPorSelo,
  });

  /// Endereço para abrir, ou null. Só http(s) vira link: qualquer outro esquema vai para null,
  /// porque no WebView 'intent:' abre app externo e 'data:' e 'file:' não são links da turma.
  final String? url;

  /// 'aula de 2 set', ou vazio quando o material não é de uma aula.
  final String daAula;

  /// Para a tela decidir se oferece editar. Só o autor edita.
  final String autorId;
  final String id;

  /// Rótulo de formato ('PDF', 'JPG', 'LINK'). Não é o tipo AULA/ADICIONAL.
  final String tipo;
  final String titulo;
  final String autoria;
  final TipoSelo? autoriaSelo;
  final String? editadoPor;
  final TipoSelo? editadoPorSelo;

  /// Só o booleano: o texto do resumo não vai para uma lista inteira.
  final bool temResumo;
}

MaterialVm materialVm(modelos.Material m, DateTime agora) {
  final ref = m.arquivoRef ?? m.url;
  return MaterialVm(
    id: m.id,
    tipo: _formato(ref),
    titulo: m.titulo,
    url: _abrivel(ref),
    daAula: _rotuloDaAula(m.dataAula),
    autorId: m.autoria.autorId,
    autoria: assinatura(m.autoria, agora),
    autoriaSelo: seloDoModelo(m.autoria.autorSelo),
    editadoPor: m.autoria.editadoPorNome,
    editadoPorSelo: seloDoModelo(m.autoria.editadoPorSelo),
    temResumo: m.resumo != null,
  );
}

final _esquemaWeb = RegExp(r'^https?://', caseSensitive: false);

/// Só http(s) vira link. O servidor já recusa o resto ao gravar, mas a defesa fica aqui também:
/// o sanitizador do Angular só barrava 'javascript:', e o app Flutter não tem esse sanitizador.
String? _abrivel(String? ref) =>
    ref != null && _esquemaWeb.hasMatch(ref) ? ref : null;

final _extensao = RegExp(r'\.([a-z0-9]{1,5})(?:$|[?#])', caseSensitive: false);

/// Extensão do arquivo ou do link em maiúsculas. Sem extensão, 'LINK': resposta honesta em vez de
/// chutar 'PDF'.
String _formato(String? ref) {
  final m = _extensao.firstMatch(ref ?? '');
  return m == null ? 'LINK' : m.group(1)!.toUpperCase();
}

/// 'aula de 2 set'. Vazio sem data. A data é partida como string, sem DateTime, pelo mesmo motivo
/// do EventoVm (fuso negativo andaria um dia para trás).
String _rotuloDaAula(String? data) {
  if (data == null || data.isEmpty) return '';
  final partes = data.split('-');
  if (partes.length < 3) return '';
  final mes = int.tryParse(partes[1]);
  final dia = int.tryParse(partes[2]);
  if (mes == null || dia == null || mes < 1 || mes > 12) return '';
  return 'aula de $dia ${meses[mes - 1]}';
}
