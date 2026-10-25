// Configuração de build. Tudo vem de --dart-define; o padrão é produção.
//
// Dev: flutter run --dart-define=API_URL=http://localhost:8080/api/v1 \
//        --dart-define=RECUPERACAO_POR_EMAIL=false

/// Base da API. Mesmos caminhos, corpos e erros do backend Ionic.
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://projetofans-api.onrender.com/api/v1',
);

/// Se o build envia e-mail de recuperação. Dev: false (a tela explica que não há envio).
const bool recuperacaoPorEmail = bool.fromEnvironment(
  'RECUPERACAO_POR_EMAIL',
  defaultValue: true,
);

/// Teto de espera de toda requisição. Cold start do Render mede ~45 s; 30 s abortaria
/// requisição legítima.
const Duration tetoDeEsperaPadrao = Duration(seconds: 75);
