import 'package:fans_lab/config.dart';
import 'package:fans_lab/database/app_database.dart';
import 'package:fans_lab/repositories/estado_pessoal_repository.dart';
import 'package:fans_lab/repositories/home_cache_repository.dart';
import 'package:fans_lab/repositories/materia_repository.dart';
import 'package:fans_lab/repositories/rascunho_repository.dart';
import 'package:fans_lab/repositories/sessao_store.dart';
import 'package:fans_lab/services/api_service.dart';
import 'package:fans_lab/services/home_service.dart';
import 'package:fans_lab/services/notificacao_service.dart';
import 'package:fans_lab/services/sync_service.dart';
import 'package:fans_lab/services/upload_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Montagem única das dependências. As telas recebem isto pronto; testes trocam
/// o cliente HTTP e o banco pelo construtor `padrao`.
class AppDeps {
  final ApiService api;
  final SessaoStore sessao;
  final HomeCacheRepository homeCache;
  final MateriaRepository materias;
  final RascunhoRepository rascunhos;
  final EstadoPessoalRepository estado;
  final HomeService home;
  final SyncService sync;
  final AbrirDb abrirDb;
  final UploadService upload;
  final NotificacaoService notificacoes;

  const AppDeps({
    required this.api,
    required this.sessao,
    required this.homeCache,
    required this.materias,
    required this.rascunhos,
    required this.estado,
    required this.home,
    required this.sync,
    required this.abrirDb,
    required this.upload,
    required this.notificacoes,
  });

  factory AppDeps.padrao({
    http.Client? client,
    AbrirDb? abrirDb,
    String baseUrl = apiUrl,
    Dio? dio,
    FlutterSecureStorage? cofre,
  }) {
    final api = ApiService(client: client, baseUrl: baseUrl);
    final abrir = abrirDb ?? AppDatabase.abrir;
    final homeCache = HomeCacheRepository(abrir);
    final materias = MateriaRepository(abrir);
    final rascunhos = RascunhoRepository(abrir);
    final estado = EstadoPessoalRepository(abrir);
    final sessao = cofre == null ? SessaoStore() : SessaoStore(cofre);
    return AppDeps(
      api: api,
      sessao: sessao,
      homeCache: homeCache,
      materias: materias,
      rascunhos: rascunhos,
      estado: estado,
      home: HomeService(api, homeCache, estado, materias, sessao),
      sync: SyncService(api, rascunhos, estado, sessao),
      abrirDb: abrir,
      upload: UploadService(api, dio: dio),
      notificacoes: NotificacaoService(),
    );
  }
}
