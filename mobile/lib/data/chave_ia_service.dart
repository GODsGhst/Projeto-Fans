import '../core/armazenamento.dart';

/// Chave do Preferences deste aparelho. Mesma chave do app Ionic.
const String chaveIa = 'projetofans.chave-ia';

/// A chave da IA de cada pessoa, guardada só no aparelho dela.
///
/// Não está no código (APK é extraível) nem no servidor (viraria alvo). Ela só existe
/// no disco do aparelho e sai junto com a requisição, no header, usada e descartada.
class ChaveIaService {
  ChaveIaService({required this.armazenamento});

  final Armazenamento armazenamento;

  /// null = ainda não lida do disco. '' = lida, e não há nenhuma.
  String? _cache;

  Future<String> ler() async {
    final emCache = _cache;
    if (emCache != null) return emCache;
    final lido = await armazenamento.lerJson(chaveIa);
    final chave = lido is String ? lido : '';
    _cache = chave;
    return chave;
  }

  /// Faz trim. Vazia remove a chave do disco.
  Future<void> gravar(String chave) async {
    final limpa = chave.trim();
    _cache = limpa;
    if (limpa.isEmpty) {
      await armazenamento.remover(chaveIa);
      return;
    }
    await armazenamento.gravarJson(chaveIa, limpa);
  }

  /// Só o começo e o fim. A tela confirma que há chave sem exibi-la.
  Future<String> mascarada() async {
    final chave = await ler();
    if (chave.isEmpty) return '';
    if (chave.length <= 12) return '••••';
    return '${chave.substring(0, 8)}…${chave.substring(chave.length - 4)}';
  }
}
