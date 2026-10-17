namespace Bicicletas.IntegrationTests.Infraestructura;

/// <summary>
/// Prueba que requiere el PostgreSQL 17 efímero del pipeline (variable ConnectionStrings__Pruebas).
/// En un equipo sin esa variable la prueba se omite en lugar de fallar.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class FactConBaseDatosAttribute : FactAttribute
{
    public FactConBaseDatosAttribute()
    {
        if (string.IsNullOrWhiteSpace(FabricaApi.CadenaPruebas))
            Skip = "Sin base de datos de pruebas (defina ConnectionStrings__Pruebas).";
    }
}
