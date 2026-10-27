# -----------------------------------------------------------------------
# KRConnects Data API - multi-stage Dockerfile
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
WORKDIR /app
COPY --from=build /app/publish .

# Run as the built-in non-root user of the .NET image
USER $APP_UID

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "DataApi.dll"]
