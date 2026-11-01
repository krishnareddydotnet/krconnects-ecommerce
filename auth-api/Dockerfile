# -----------------------------------------------------------------------
# KRConnects Auth API - multi-stage Dockerfile
#
# Tech stack : .NET 10, ASP.NET Core Web API, JWT
# Port       : 8080
# Runs as    : app (UID 1654, $APP_UID of the .NET image)
# Stages     : 1) build   (mcr.microsoft.com/dotnet/sdk:10.0) -> dotnet restore, dotnet publish -c Release
#              2) runtime (mcr.microsoft.com/dotnet/aspnet:10.0) -> runs AuthApi.dll
#
# Local commands (run from the auth-api folder):
#   Build image : docker build -t auth-api:v1.0.0 .
#   Run         : docker run --rm -p 8080:8080 auth-api:v1.0.0
#   Test        : curl http://localhost:8080/health/live
#   Unit tests  : dotnet test tests/AuthApi.Tests/AuthApi.Tests.csproj
# -----------------------------------------------------------------------

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY AuthApi.csproj ./
RUN dotnet restore AuthApi.csproj

COPY src/ ./src/
RUN dotnet publish AuthApi.csproj -c Release -o /app/publish

# Stage 2: Run
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Run as the built-in non-root user of the .NET image (UID 1654)
USER $APP_UID

ENTRYPOINT ["dotnet", "AuthApi.dll"]
