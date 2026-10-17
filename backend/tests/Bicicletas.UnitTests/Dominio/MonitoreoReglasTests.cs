using Bicicletas.Application.Comun;
using Bicicletas.Application.Monitoreo;

namespace Bicicletas.UnitTests.Dominio;

public class MonitoreoReglasTests
{
    [Theory]
    [InlineData("Trek (Rojo)", "Trek (Rojo)")]
    [InlineData("=HYPERLINK(\"x\")", "\"'=HYPERLINK(\"\"x\"\")\"")]
    [InlineData("-5+3", "'-5+3")]
    [InlineData("a;b", "\"a;b\"")]
    [InlineData(null, "")]
    public void Celda_EscapaYNeutralizaFormulas(string? valor, string esperado)
    {
        Assert.Equal(esperado, MonitoreoService.Celda(valor));
    }

    [Fact]
    public void HoraPeru_HoyYSuInicioEnUtc_UsanUtcMenos5()
    {
        // 03:00 UTC del 18/10 son las 22:00 del 17/10 en Lima.
        var reloj = new RelojFijo(new DateTimeOffset(2026, 10, 18, 3, 0, 0, TimeSpan.Zero));
        DateOnly hoy = HoraPeru.Hoy(reloj);
        Assert.Equal(new DateOnly(2026, 10, 17), hoy);
        Assert.Equal(new DateTime(2026, 10, 17, 5, 0, 0, DateTimeKind.Utc), HoraPeru.InicioDelDiaUtc(hoy));
    }

    private sealed class RelojFijo(DateTimeOffset ahora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => ahora;
    }
}
