using System.Text;
using Bicicletas.Api;
using Bicicletas.Api.Endpoints;
using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Autenticacion;
using Bicicletas.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

// Punto de entrada de la API REST (capa de presentación de la lógica de negocio, P05).
// La configuración sensible llega solo por variables de entorno (Render), nunca desde el código.
var builder = WebApplication.CreateBuilder(args);

// Render indica el puerto en la variable PORT; en local se usa la configuración por defecto.
string? puerto = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(puerto))
    builder.WebHost.UseUrls($"http://0.0.0.0:{puerto}");

builder.Services.AddInfraestructura();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<AutenticacionService>();
builder.Services.AddSingleton<IGeneradorToken, GeneradorJwt>();

// JWT: la configuración se valida al arrancar; si falta la clave, la API no inicia.
builder.Services.AddOptions<OpcionesJwt>()
    .Bind(builder.Configuration.GetSection(OpcionesJwt.Seccion))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<OpcionesJwt>>((opciones, jwt) =>
    {
        opciones.MapInboundClaims = false;   // conserva los nombres sub e id_rol
        opciones.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Value.Emisor,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.ClaveFirma)),
            NameClaimType = ClaimsSistema.IdUsuario,
            RoleClaimType = ClaimsSistema.IdRol,
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ManejadorExcepciones>();
builder.Services.AddControllers();

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();

app.MapSalud();
app.MapControllers();

app.Run();

/// <summary>Expone la clase Program a las pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
