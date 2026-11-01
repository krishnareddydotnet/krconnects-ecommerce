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

# Non-root user with a fixed NUMERIC UID (10001), so Kubernetes "runAsNonRoot" can verify it.
# No home directory and no login shell: the user only runs the app.
RUN useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin appuser

# app.jar stays owned by root and read-only (0444): the app user can read and run it, but not change it
COPY --from=build --chmod=0444 /src/target/catalog-api-1.0.0.jar app.jar

# Run as the non-root user (numeric UID, not the name)
USER 10001

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
