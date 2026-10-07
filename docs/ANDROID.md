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

## O SDK do Android sumiu da máquina — 2026-09-02 · **RESOLVIDO no mesmo dia**

`./gradlew assembleDebug` passou a falhar com **"SDK location not found"**. Não é configuração
errada: o SDK não está mais aqui. Conferido — `%LOCALAPPDATA%\Android` não existe, `ANDROID_HOME` e
`ANDROID_SDK_ROOT` estão vazias, e as duas instalações do Android Studio
(`Android Studio` e `Android Studio1`) não trazem SDK dentro.

Em 2026-09-01 o mesmo comando compilou (`BUILD SUCCESSFUL`, 243 tarefas). Então o SDK foi removido
entre um dia e outro — desinstalação, limpeza de disco, ou a segunda instalação do Studio levando a
primeira junto.

**Consequência:** o APK não pode ser regerado até isso voltar. O `app-debug.apk` de 01/09 continua
válido e instalável, mas é anterior aos consertos de 02/09 — ou seja, ainda tem as abas que não
recarregam e as duas telas que mentem.

**Como foi resolvido (02/09, 15h):** instaladas as *command line tools* oficiais
(`commandlinetools-win-16111833_latest.zip`, 147 MB, de `dl.google.com/android/repository`),
extraídas em `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`, e daí:

```
android --no-metrics sdk install platform-tools "platforms;android-36" "build-tools;36.0.0"
```

Duas surpresas dessa versão: o `sdkmanager` foi substituído pelo CLI `android`, e `--licenses`
não existe mais — a aceitação virou parte do próprio install. E o `--no-metrics` vem **antes** do
subcomando, não depois; o CLI manda telemetria por padrão.

O `local.properties` foi criado com `sdk.dir` apontando para o SDK. Ele é ignorado pelo git
(`.gitignore:27`) porque é caminho de máquina — e é justamente ele que evita depender de
`ANDROID_HOME`, que foi o que falhou aqui.

Compilar agora é só:

```
cd app/android && JAVA_HOME="C:/Program Files/Zulu/zulu-25" ./gradlew assembleDebug
```

---

**Para voltar a compilar:** abra o Android Studio → *More Actions* → *SDK Manager* e instale a
plataforma que o projeto pede (veja `compileSdkVersion` em `android/variables.gradle`). Depois:

```
JAVA_HOME="C:/Program Files/Zulu/zulu-25" ANDROID_HOME="C:/Users/<voce>/AppData/Local/Android/Sdk" ./gradlew assembleDebug
```

Se preferir não instalar o Studio inteiro, bastam as *command line tools* do Android e um
`sdkmanager "platform-tools" "platforms;android-XX" "build-tools;XX.Y.Z"`.

**Atalho que evita repetir isso:** crie `app/android/local.properties` com uma linha
`sdk.dir=C\:\Users\<voce>\AppData\Local\Android\Sdk`. O arquivo é ignorado pelo git
de propósito (é caminho de máquina), e com ele o Gradle acha o SDK sem depender de variável de
ambiente — que é justamente o que falhou aqui.

---

## O JDK do Android mudou — 2026-09-02, 15h50

**Não use mais o zulu-25 para o Android.** Ele passou a falhar assim:

```
A problem occurred evaluating settings 'android'.
> BUG! exception in phase 'semantic analysis' ... Unsupported class file major version 69
```

`major version 69` é Java 25. O Gradle 8.14.3 (o do wrapper deste projeto) não entende bytecode
25 nos próprios scripts de build. Isso **não** apareceu antes porque havia um daemon do Gradle já
aquecido com outra JVM sendo reaproveitado — o erro só saiu quando `npx cap sync` mexeu no
`capacitor.settings.gradle` e forçou a reavaliação com daemon novo. É o tipo de falha que parece
intermitente e não é.

**O JDK que funciona hoje é o 24:**

```
cd app/android && JAVA_HOME="C:/Program Files/Java/jdk-24" ./gradlew assembleDebug
```

A tabela dos dois `JAVA_HOME` continua valendo na ideia — backend e Android precisam de JDKs
diferentes —, só mudou qual é o do Android: **jdk-24**, não zulu-25. Se um dia o Gradle subir de
versão, o 25 volta a servir.

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

## A cada APK novo: subir a versão, nos DOIS lugares

A versão que o app mostra (Perfil → "Versão X") sai de **um lugar só**: o campo `version` de
`app/package.json`, importado pelo `perfil.page.ts`. É ali que se muda.

Só que o Android tem a dele, e ela não sai do `package.json`: `versionCode` e `versionName` em
`app/android/app/build.gradle`. Como `android/` é ignorado pelo git, **essa troca não aparece em
diff nenhum** — tem de ser feita à mão, a cada APK, junto com a do `package.json`:

| Onde | Campo | 1.1.0 (06/10/2026) |
|---|---|---|
| `app/package.json` | `version` | `"1.1.0"` |
| `app/android/app/build.gradle` | `versionCode` | `2` — **inteiro, sempre +1** |
| `app/android/app/build.gradle` | `versionName` | `"1.1.0"` — igual ao `package.json` |

O `versionCode` é o que o Android compara: APK com código **menor** que o instalado é recusado
(downgrade), e o colega teria de desinstalar — perdendo a sessão — para instalar. Código **igual**
instala, mas aí "Versão X" no Perfil e o APK no celular deixam de dizer a mesma coisa, e um relato
de bug não diz mais de qual build ele fala.

### O keystore de debug precisa de cópia fora deste notebook

O APK de debug é assinado com `~/.android/debug.keystore` (aqui:
`C:\Users\gh0st\.android\debug.keystore`). O Android só instala por cima um APK **assinado com a
mesma chave** do que já está no celular. Se esse arquivo se perder — formatação, troca de máquina,
limpeza da pasta `.android` —, o Gradle gera outro sozinho, sem avisar, e o próximo APK **não
instala por cima** em nenhum celular da turma: cada pessoa teria de desinstalar e entrar de novo.

Guarde uma cópia do `debug.keystore` fora do notebook (Drive, pendrive). Ao montar outra máquina,
coloque a cópia em `~/.android/` **antes** do primeiro `assembleDebug`.

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

---

## Mudar o `build.gradle` quebra o build com Java 25 — 2026-10-07

Subir `versionCode`/`versionName` em `app/android/app/build.gradle` fez o `assembleDebug`
falhar com **"Unsupported class file major version 69"**. Não é o app: é o Groovy do Gradle
8.14.3 recompilando o *script* `build.gradle`, e ele não lê bytecode do Java 25. Enquanto o
script não muda, o Gradle reaproveita a versão compilada em cache e o Java 25 "funciona" — foi
por isso que a seção acima registrou o 25 como verificado.

Consequência prática: **qualquer edição no `build.gradle` quebra o build nesta máquina** até
existir um JDK 21 (ou 24) para o Gradle rodar. O APK 1.2.0 saiu com `versionCode 1` /
`versionName "1.0"` de propósito, o conteúdo de antes, para reaproveitar o cache. A versão que a
pessoa vê no Perfil vem do `package.json` (1.2.0), não do Android, e um APK com `versionCode`
**igual** instala por cima do anterior (só menor é recusado).

Para voltar a subir o `versionCode`: instalar um JDK 21 e usar esse `JAVA_HOME` no `gradlew`.
