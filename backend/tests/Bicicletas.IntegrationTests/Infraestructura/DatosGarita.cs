using Bicicletas.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests.Infraestructura;

/// <summary>Crea un estudiante sintético con una bicicleta en el estado indicado.</summary>
public static class DatosGarita
{
    public sealed record BicicletaPrueba(Guid IdBicicleta, string CodigoQr, Guid IdEstudiante);

    public static async Task<BicicletaPrueba> CrearBicicletaAsync(FabricaApi fabrica, string estado = "FUERA")
    {
        ArgumentNullException.ThrowIfNull(fabrica);
        Guid idEstudiante = Guid.NewGuid();
        Guid idBicicleta = Guid.NewGuid();
        string qr = Guid.NewGuid().ToString();
        string sufijo = idEstudiante.ToString("N")[..8];
        string dni = Random.Shared.Next(10_000_000, 99_999_999).ToString(System.Globalization.CultureInfo.InvariantCulture);
        string codigo = "9" + Random.Shared.NextInt64(100_000_000, 999_999_999).ToString(System.Globalization.CultureInfo.InvariantCulture);

        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash, debe_cambiar_password)
            VALUES ({idEstudiante}, 1, {"it.alumno." + sufijo + "@estudiante.ucsm.edu.pe"}, 'x', false);
            INSERT INTO estudiantes (id_estudiante, codigo_universitario, dni, nombres, apellidos, facultad)
            VALUES ({idEstudiante}, {codigo}, {dni}, 'ALUMNO', 'DE PRUEBA', 'Facultad de Prueba');
            INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color, estado)
            VALUES ({idBicicleta}, {idEstudiante}, {qr}, {"IT-" + sufijo}, 'Marca Prueba', 'Rojo', {estado});
            """);
        return new BicicletaPrueba(idBicicleta, qr, idEstudiante);
    }

    /// <summary>Registra el descriptor de referencia (sintético) del titular.</summary>
    public static async Task EnrolarAsync(FabricaApi fabrica, Guid idEstudiante, double[] vector)
    {
        ArgumentNullException.ThrowIfNull(fabrica);
        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO descriptores_biometricos (id_estudiante, vector_embedding, version_modelo)
            VALUES ({idEstudiante}, {vector}, 'face-api-0.22.2');
            """);
    }
}
