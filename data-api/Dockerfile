# -----------------------------------------------------------------------
# KRConnects Data API - multi-stage Dockerfile
#
# Tech stack : .NET 10, ASP.NET Core Web API, EF Core 10 (Azure SQL)
# Port       : 8080
# Runs as    : app (UID 1654, $APP_UID of the .NET image)
# Stages     : 1) build   (mcr.microsoft.com/dotnet/sdk:10.0) -> dotnet restore, dotnet publish -c Release
#              2) runtime (mcr.microsoft.com/dotnet/aspnet:10.0) -> runs DataApi.dll
#
# Local commands (run from the data-api folder):
#   Build image : docker build -t data-api:v1.0.0 .
#   Run         : docker run --rm -p 8080:8080 -e ConnectionStrings__DataDb="<your-azure-sql-connection-string>" data-api:v1.0.0
#                 (needs a reachable Azure SQL: data-api checks the database at startup)
#   Test        : curl http://localhost:8080/health/live
#   Unit tests  : dotnet test tests/DataApi.Tests/DataApi.Tests.csproj
# -----------------------------------------------------------------------

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY DataApi.csproj ./
RUN dotnet restore DataApi.csproj

COPY src/ ./src/
RUN dotnet publish DataApi.csproj -c Release -o /app/publish

# Stage 2: Run
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

# Temporary fix for CVE-2026-109518 (apt / libapt-pkg6.0t64 in the Ubuntu 24.04 base layer).
# Runs as root (before USER). Remove this line once Microsoft republishes aspnet:10.0 with the fixed apt.
RUN apt-get update \
    && apt-get install --only-upgrade -y apt libapt-pkg6.0t64 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

# Run as the built-in non-root user of the .NET image
USER $APP_UID

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "DataApi.dll"]
