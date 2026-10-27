# -----------------------------------------------------------------------
# KRConnects Auth API - multi-stage Dockerfile
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
