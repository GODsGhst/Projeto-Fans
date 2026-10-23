import 'package:fans_lab/models/item_home.dart';
import 'package:fans_lab/models/materia.dart';
import 'package:fans_lab/repositories/estado_pessoal_repository.dart';
import 'package:fans_lab/repositories/home_cache_repository.dart';
import 'package:fans_lab/repositories/materia_repository.dart';
import 'package:fans_lab/repositories/sessao_store.dart';
import 'package:fans_lab/services/api_exception.dart';
import 'package:fans_lab/services/api_service.dart';

/// Home carregada. `offline` true quer dizer que veio do cache, salvo em `salvoEm`.
class ResultadoHome {
  final List<ItemHome> itens;
  final bool offline;
  final DateTime? salvoEm;

  const ResultadoHome({
    required this.itens,
    required this.offline,
    this.salvoEm,
  });
}

/// API primeiro; cache só quando não há rede (ou o servidor caiu).
class HomeService {
  final ApiService _api;
  final HomeCacheRepository _cache;
  final EstadoPessoalRepository _estado;
  final MateriaRepository _materias;
  final SessaoStore _sessao;

  HomeService(
    this._api,
    this._cache,
    this._estado,
    this._materias,
    this._sessao,
  );

  Future<ResultadoHome> carregar() async {
    try {
      final itens = await _api.home();
      await _cache.substituir(itens);
      await _estado.aplicarDoServidor({
        for (final i in itens) i.eventoId: i.feitoPeloUsuario,
      });
      final agora = DateTime.now();
      await _sessao.registrarHomeSalva(agora);
      // Lê do cache, não de `itens`: o `feito` pendente local tem de prevalecer.
      return ResultadoHome(
        itens: await _cache.listar(),
        offline: false,
        salvoEm: agora,
      );
    } on ApiException catch (e) {
      if (e.naoAutorizado || !_semRede(e)) rethrow;
      final salvoEm = await _sessao.homeSalvaEm();
      // Nunca carregou: sem cache, falha é falha. Não devolver lista vazia.
      if (salvoEm == null) rethrow;
      return ResultadoHome(
        itens: await _cache.listar(),
        offline: true,
        salvoEm: salvoEm,
      );
    }
  }

  Future<List<Materia>> materias() async {
    try {
      final lista = await _api.materias();
      await _materias.substituirTodas(lista);
      // Lê do cache, não devolve `lista`: a ordem tem de ser a mesma online e offline (por sigla).
      return await _materias.listar();
    } on ApiException catch (e) {
      if (e.naoAutorizado || !_semRede(e)) rethrow;
      final cache = await _materias.listar();
      // Cache vazio + falha de rede é falha, não "nenhuma matéria".
      if (cache.isEmpty) rethrow;
      return cache;
    }
  }

  static bool _semRede(ApiException e) =>
      e.semConexao || (e.status ?? 0) >= 500;
}
