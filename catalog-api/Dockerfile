# -----------------------------------------------------------------------
# KRConnects Catalog API - multi-stage Dockerfile
#
# Tech stack : Java 25, Spring Boot 4.1, Maven 3.9
# Port       : 8081
# Runs as    : UID 10001 (created in the runtime stage)
# Stages     : 1) build   (maven:3.9-eclipse-temurin-25) -> mvn dependency:go-offline, mvn clean package (app jar)
#              2) runtime (eclipse-temurin:25-jre) -> runs java -jar app.jar
#
# Local commands (run from the catalog-api folder):
#   Build image : docker build -t catalog-api:v1.0.0 .
#   Run         : docker run --rm -p 8081:8081 catalog-api:v1.0.0
#   Test        : curl http://localhost:8081/actuator/health/liveness
#   Unit tests  : mvn test
# -----------------------------------------------------------------------

# Stage 1: Build
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src

COPY pom.xml ./
RUN mvn dependency:go-offline -B

COPY src/ ./src/
RUN mvn clean package -DskipTests -B

# Stage 2: Run
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app

COPY --from=build /src/target/catalog-api-1.0.0.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
