using Bicicletas.Api.Endpoints;
using Bicicletas.Infrastructure;

// Punto de entrada de la API REST (capa de presentación de la lógica de negocio, P05).
// La configuración sensible llega solo por variables de entorno (Render), nunca desde el código.
var builder = WebApplication.CreateBuilder(args);

// Render indica el puerto en la variable PORT; en local se usa la configuración por defecto.
string? puerto = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(puerto))
    builder.WebHost.UseUrls($"http://0.0.0.0:{puerto}");

builder.Services.AddInfraestructura();

var app = builder.Build();

app.MapSalud();

app.Run();

/// <summary>Expone la clase Program a las pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
