using System.Reflection;

namespace Bicicletas.UnitTests;

/// <summary>
/// Verifica la regla de dependencias de la arquitectura en capas (P05):
/// Api → Application → Domain; Infrastructure implementa las interfaces de Application.
/// El dominio no debe depender de ninguna otra capa (inversión de dependencias, SOLID-D).
/// </summary>
public class ArquitecturaTests
{
    private static string[] ReferenciasInternas(string ensamblado) =>
        Assembly.Load(new AssemblyName(ensamblado))
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty)
            .Where(n => n.StartsWith("Bicicletas.", StringComparison.Ordinal))
            .ToArray();

    [Fact]
    public void Domain_NoDependeDeOtrasCapas()
    {
        Assert.Empty(ReferenciasInternas("Bicicletas.Domain"));
    }

    [Fact]
    public void Application_SoloDependeDelDominio()
    {
        Assert.All(ReferenciasInternas("Bicicletas.Application"),
            n => Assert.Equal("Bicicletas.Domain", n));
    }
}
