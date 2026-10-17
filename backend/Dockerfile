# Imagen multietapa de la API para Render (CC-09). Configuración solo por variables de entorno:
# ConnectionStrings__Principal, Jwt__ClaveFirma, Jwt__Emisor, Cors__OrigenPermitido.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS compilacion
WORKDIR /src
COPY Directory.Build.props BicicletasUcsm.sln ./
COPY src/ src/
COPY tests/ tests/
RUN dotnet restore BicicletasUcsm.sln
RUN dotnet publish src/Bicicletas.Api/Bicicletas.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS ejecucion
WORKDIR /app
COPY --from=compilacion /app ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Bicicletas.Api.dll"]
