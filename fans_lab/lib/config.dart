// URL base da API. Sobrescreva no build: flutter run --dart-define=API_URL=<url>
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://projetofans-api.onrender.com/api/v1',
);
