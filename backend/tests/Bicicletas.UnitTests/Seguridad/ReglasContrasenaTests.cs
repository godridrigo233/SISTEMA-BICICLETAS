using Bicicletas.Domain.Comun;
using Bicicletas.Domain.Usuarios;

namespace Bicicletas.UnitTests.Seguridad;

public class ReglasContrasenaTests
{
    [Theory]
    [InlineData("corta1")]                // menos de 10 caracteres
    [InlineData("solamenteletras")]       // sin números
    [InlineData("1234567890123")]         // sin letras
    public void Validar_ContrasenaFueraDePolitica_Lanza422(string nueva)
    {
        Assert.Throws<ValidacionNegocioException>(() => ReglasContrasena.Validar(nueva, "Temporal2026x"));
    }

    [Fact]
    public void Validar_IgualALaTemporal_Lanza422()
    {
        Assert.Throws<ValidacionNegocioException>(() => ReglasContrasena.Validar("Temporal2026x", "Temporal2026x"));
    }

    [Fact]
    public void Validar_ContrasenaValida_NoLanza()
    {
        Exception? excepcion = Record.Exception(() => ReglasContrasena.Validar("MiBicicleta2026", "Temporal2026x"));
        Assert.Null(excepcion);
    }
}
