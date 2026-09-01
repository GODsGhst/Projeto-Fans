# Gerar o APK

O projeto nativo foi gerado pela primeira vez em **2026-08-31**. Este documento existe porque
`android/` é **descartável** (o `.gitignore` o ignora): quem clonar o repo não recebe a pasta, e
tudo que ela precisa tem de estar escrito aqui ou no `capacitor.config.ts`.

---

## A armadilha: esta máquina precisa de DOIS `JAVA_HOME` diferentes

Isto não é preferência, é incompatibilidade real, e já custou um build quebrado de cada lado:

| O que você vai rodar | `JAVA_HOME` obrigatório | Por quê |
|---|---|---|
| **Backend** (`./mvnw`) | `C:\Users\gh0st\dev-tools\jdk-17` | o `pom.xml` compila com `release 17` |
| **Android** (`./gradlew`) | `C:\Program Files\Zulu\zulu-25` | o Capacitor 8 compila com `source release 21` |

**O `JAVA_HOME` global desta máquina aponta para o 17.** Então o backend funciona sozinho e o
Android **não**: `./gradlew assembleDebug` falha com

```
error: invalid source release: 21
```

É exatamente a mesma classe de erro que quebrou o backend quando alguém subiu o `pom` para Java 25
sem mexer no `JAVA_HOME` — Maven e Gradle usam o `JAVA_HOME`, não o `java` do `PATH`.

Não existe JDK 21 nem 24 aqui; só 17 e 25. O Gradle 8.14.3 suporta oficialmente até o 24, mas
**roda no 25 nesta configuração** — verificado, build completo.

---

## Gerar o APK, do zero

```bash
cd app && npm install && npx ng build && npx cap add android
```

Depois, com o `JAVA_HOME` certo:

```bash
cd app/android && JAVA_HOME="C:/Program Files/Zulu/zulu-25" ANDROID_HOME="$HOME/AppData/Local/Android/Sdk" ./gradlew assembleDebug
```

O APK sai em:

```
app/android/app/build/outputs/apk/debug/app-debug.apk
```

Se a pasta `android/` já existir, pule o `cap add` e use `npx cap sync android` para levar o
`www/` novo para dentro dela.

---

## Instalar no celular

**Por cabo**, com depuração USB ligada:

```bash
"$HOME/AppData/Local/Android/Sdk/platform-tools/adb.exe" install -r app/android/app/build/outputs/apk/debug/app-debug.apk
```

**Sem cabo:** mande o `.apk` por WhatsApp, Drive ou e-mail. Quem receber precisa autorizar
"instalar de fontes desconhecidas" para o aplicativo que abriu o arquivo. É um APK de debug e não
está assinado para a Play Store — para um teste de turma isso é o esperado.

---

## Antes de mandar para alguém: aponte para a API certa

O APK usa `app/src/environments/environment.prod.ts`, porque `ng build` já constrói em modo de
produção. Hoje ele está com um endereço de exemplo:

```ts
apiUrl: 'https://api.projetofans.app/api/v1'   // não existe
```

**Um APK gerado assim instala e abre, mas nenhuma tela carrega dado** — ele fala com um servidor
que não está lá. Depois de subir a API (ver `docs/DEPLOY.md`), troque para a URL real do Render e
gere de novo:

```ts
apiUrl: 'https://projetofans-api.onrender.com/api/v1'
```

---

## Se quiser testar por wifi em vez de hospedar

Android 9+ bloqueia HTTP sem TLS, então apontar para `http://192.168.x.x:8080` **falha em
silêncio** — erro de rede, indistinguível de servidor fora do ar. Para permitir, temporariamente,
no `capacitor.config.ts`:

```ts
server: { cleartext: true }
```

Depois `npx cap sync android` e gere o APK de novo. **Tire quando terminar:** APK distribuído com
cleartext ligado aceita qualquer intermediário na rede da faculdade. Ver A19 em
`PERGUNTAS-ABERTAS.md`.

---

## O que ainda falta no APK

- **Ícone e splash** são os padrões do Ionic. É a C1 (nome e identidade), adiada de propósito.
- **Não está assinado** para distribuição em loja. Para teste direto, não precisa.
- **Push não funciona** — é a Task 8, e ela vai precisar de um `google-services.json` dentro de
  `android/app/`, que hoje seria perdido na regeneração. Ver A18.
