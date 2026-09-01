# Imagem da API do projetoFans, para o ambiente hospedado de teste.
#
# Duas fases: a primeira compila com Maven, a segunda carrega so o JRE e o jar.
# Sem isso a imagem final levaria o Maven inteiro e o repositorio ~/.m2 junto —
# varias centenas de MB que nunca rodam nada em producao.
#
# Java 17 e a mesma versao do pom. Elas TEM de bater: o jar compilado com release
# 17 roda em JRE 17 ou maior, mas manter as duas no mesmo numero evita a classe de
# bug que ja mordeu este projeto uma vez, quando o pom pedia 25 e o Maven rodava
# no 17.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src

# pom antes do src: enquanto as dependencias nao mudarem, o Docker reaproveita a
# camada e o build nao rebaixa a internet toda a cada commit de codigo.
COPY pom.xml .
COPY src ./src

# -DskipTests de proposito: a suite precisa do binario do Postgres embutido, e
# rodar 76 testes dentro do build de deploy dobraria o tempo sem dizer nada novo.
# Os testes rodam antes, na maquina de quem desenvolve, e sao o criterio de aceite
# de toda tarefa. Build de deploy empacota; nao e onde se descobre regressao.
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar

# O perfil teste nao exige conta externa nenhuma alem do Postgres: e-mail cai no
# log e o login por Google entra desligado com mensagem clara.
ENV SPRING_PROFILES_ACTIVE=teste

# MaxRAMPercentage porque o container tem limite e a JVM, sem isso, calcula heap
# olhando a memoria da MAQUINA — no free tier isso vira OOM logo no primeiro pico.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "app.jar"]
