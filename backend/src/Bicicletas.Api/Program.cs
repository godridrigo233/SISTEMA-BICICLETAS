using System.Text;
using Bicicletas.Api;
using Bicicletas.Api.Endpoints;
using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Autenticacion;
using Bicicletas.Application.Contingencias;
using Bicicletas.Application.Estudiantes;
using Bicicletas.Application.Garita;
using Bicicletas.Application.Monitoreo;
using Bicicletas.Application.Retiros;
using Bicicletas.Application.Usuarios;
using Bicicletas.Domain.Biometria;
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
builder.Services.AddScoped<RegistrarIngresoService>();
builder.Services.AddScoped<AutorizarRetiroService>();
builder.Services.AddScoped<EstudianteService>();
builder.Services.AddScoped<RetiroManualService>();
builder.Services.AddScoped<MonitoreoService>();
builder.Services.AddScoped<ContingenciaService>();
builder.Services.AddScoped<GestionUsuariosService>();
// θ calibrado con el Dataset Primario Local UCSM; se recalibra sin recompilar (Biometria__UmbralTheta).
builder.Services.AddSingleton(sp => new PoliticaBiometrica(
    sp.GetRequiredService<IConfiguration>().GetValue("Biometria:UmbralTheta", PoliticaBiometrica.UmbralPorDefecto)));
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
builder.Services.AddPoliticasRbac();

// CORS restringido al dominio del frontend en Vercel (OWASP A05): nunca "*".
// Cors__OrigenPermitido admite varios orígenes separados por coma (p. ej., producción y vista previa).
builder.Services.AddCors(opciones => opciones.AddDefaultPolicy(politica =>
{
    string[] origenes = (builder.Configuration["Cors:OrigenPermitido"] ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    politica.WithOrigins(origenes)
        .WithHeaders("Authorization", "Content-Type")
        .WithMethods("GET", "POST", "PUT", "PATCH");
}));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ManejadorExcepciones>();
builder.Services.AddControllers();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapSalud();
app.MapControllers();

app.Run();

/// <summary>Expone la clase Program a las pruebas de integración (WebApplicationFactory).</summary>
public partial class Program;
