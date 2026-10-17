using Bicicletas.Domain.Biometria;
using Xunit;

namespace Bicicletas.UnitTests.Biometria;

public sealed class PoliticaBiometricaTests
{
    private readonly PoliticaBiometrica _politica = new(umbralTheta: 0.37);

    [Theory]
    [InlineData(0.00, true)]
    [InlineData(0.37, true)]        // límite inclusivo: d ≤ θ
    [InlineData(0.3701, false)]
    [InlineData(0.4220, false)]     // menor distancia entre impostores del Dataset Primario Local
    public void EsCoincidente_RespetaElUmbral(double distancia, bool esperado) =>
        Assert.Equal(esperado, _politica.EsCoincidente(distancia));

    [Fact]
    public void Distancia_DeUnDescriptorConsigoMismo_EsCero()
    {
        double[] v = Enumerable.Range(0, 128).Select(i => Math.Sin(i) / 5).ToArray();
        Assert.Equal(0, PoliticaBiometrica.Distancia(v, v), precision: 12);
    }

    [Fact]
    public void Distancia_CalculaLaNormaEuclidiana()
    {
        double[] a = new double[128];
        double[] b = new double[128];
        b[0] = 0.3; b[1] = 0.4;                             // √(0.09 + 0.16) = 0.5
        Assert.Equal(0.5, PoliticaBiometrica.Distancia(a, b), precision: 12);
    }

    [Theory]
    [InlineData(127)]
    [InlineData(129)]
    public void Distancia_ConDimensionDistintaDe128_LanzaExcepcion(int longitud) =>
        Assert.Throws<ArgumentException>(() =>
            PoliticaBiometrica.Distancia(new double[128], new double[longitud]));

    [Fact]
    public void Distancia_ConValorNoFinito_LanzaExcepcion()
    {
        double[] capturado = new double[128];
        capturado[5] = double.NaN;
        Assert.Throws<ArgumentException>(() => PoliticaBiometrica.Distancia(new double[128], capturado));
    }
}
