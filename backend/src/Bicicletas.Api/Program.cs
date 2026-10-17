using Bicicletas.Infrastructure;

// Punto de entrada de la API REST (capa de presentación de la lógica de negocio, P05).
// La configuración sensible llega solo por variables de entorno (Render), nunca desde el código.
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfraestructura();

var app = builder.Build();

app.Run();

/// <summary>Expone la clase Program a las pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
