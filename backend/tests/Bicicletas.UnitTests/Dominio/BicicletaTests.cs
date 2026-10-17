using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Comun;

namespace Bicicletas.UnitTests.Dominio;

public class BicicletaTests
{
    private static Bicicleta Crear(EstadoBicicleta estado) => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid().ToString(), estado);

    [Fact]
    public void RegistrarIngreso_Fuera_PasaADentro()
    {
        Bicicleta bicicleta = Crear(EstadoBicicleta.Fuera);
        bicicleta.RegistrarIngreso();
        Assert.Equal(EstadoBicicleta.Dentro, bicicleta.Estado);
    }

    [Fact]
    public void RegistrarIngreso_YaDentro_LanzaConflicto()
    {
        Assert.Throws<ConflictoEstadoException>(() => Crear(EstadoBicicleta.Dentro).RegistrarIngreso());
    }

    [Fact]
    public void RegistrarSalida_Fuera_LanzaConflicto()
    {
        Assert.Throws<ConflictoEstadoException>(() => Crear(EstadoBicicleta.Fuera).RegistrarSalida());
    }
}
