# -----------------------------------------------------------------------
# KRConnects Catalog API - multi-stage Dockerfile
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
