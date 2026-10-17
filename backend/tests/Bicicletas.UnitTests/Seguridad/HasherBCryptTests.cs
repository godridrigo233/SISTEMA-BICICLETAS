using Bicicletas.Infrastructure.Seguridad;

namespace Bicicletas.UnitTests.Seguridad;

public class HasherBCryptTests
{
    private readonly HasherBCrypt _hasher = new();

    [Fact]
    public void Hashear_UsaCosto12YNoGuardaLaContrasenaEnTextoPlano()
    {
        string hash = _hasher.Hashear("Bicicleta2026");

        Assert.StartsWith("$2", hash, StringComparison.Ordinal);
        Assert.Contains("$12$", hash, StringComparison.Ordinal);
        Assert.DoesNotContain("Bicicleta2026", hash, StringComparison.Ordinal);
    }

    [Fact]
    public void Verificar_ContrasenaCorrectaEIncorrecta_DistingueAmbas()
    {
        string hash = _hasher.Hashear("Bicicleta2026");

        Assert.True(_hasher.Verificar("Bicicleta2026", hash));
        Assert.False(_hasher.Verificar("bicicleta2026", hash));
    }

    [Fact]
    public void RequiereRehash_HashDeCosto10_DevuelveVerdadero()
    {
        string hashAntiguo = BCrypt.Net.BCrypt.HashPassword("Semilla2026", workFactor: 10);

        Assert.True(_hasher.Verificar("Semilla2026", hashAntiguo));
        Assert.True(_hasher.RequiereRehash(hashAntiguo));
        Assert.False(_hasher.RequiereRehash(_hasher.Hashear("Semilla2026")));
    }

    [Fact]
    public void Verificar_HashConFormatoInvalido_DevuelveFalso()
    {
        Assert.False(_hasher.Verificar("cualquiera", "no-es-un-hash"));
    }
}
