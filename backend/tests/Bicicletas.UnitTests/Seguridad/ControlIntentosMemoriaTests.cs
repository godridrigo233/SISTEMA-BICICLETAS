using Bicicletas.Infrastructure.Seguridad;

namespace Bicicletas.UnitTests.Seguridad;

public class ControlIntentosMemoriaTests
{
    private sealed class RelojFijo(DateTimeOffset inicio) : TimeProvider
    {
        public DateTimeOffset Ahora { get; set; } = inicio;

        public override DateTimeOffset GetUtcNow() => Ahora;
    }

    private const string Correo = "alumno@ucsm.edu.pe";

    [Fact]
    public void RegistrarFallo_CincoFallos_BloqueaQuinceMinutos()
    {
        var reloj = new RelojFijo(new DateTimeOffset(2026, 10, 17, 12, 0, 0, TimeSpan.Zero));
        var control = new ControlIntentosMemoria(reloj);

        for (int i = 0; i < 4; i++)
            control.RegistrarFallo(Correo);
        Assert.Null(control.TiempoBloqueoRestante(Correo));

        control.RegistrarFallo(Correo);
        Assert.Equal(TimeSpan.FromMinutes(15), control.TiempoBloqueoRestante(Correo));

        reloj.Ahora = reloj.Ahora.AddMinutes(15).AddSeconds(1);
        Assert.Null(control.TiempoBloqueoRestante(Correo));
    }

    [Fact]
    public void RegistrarFallo_FallosFueraDeLaVentana_NoSeAcumulan()
    {
        var reloj = new RelojFijo(new DateTimeOffset(2026, 10, 17, 12, 0, 0, TimeSpan.Zero));
        var control = new ControlIntentosMemoria(reloj);

        for (int i = 0; i < 4; i++)
            control.RegistrarFallo(Correo);
        reloj.Ahora = reloj.Ahora.AddMinutes(16);
        control.RegistrarFallo(Correo);

        Assert.Null(control.TiempoBloqueoRestante(Correo));
    }

    [Fact]
    public void Reiniciar_TrasLoginExitoso_BorraLosFallos()
    {
        var control = new ControlIntentosMemoria(TimeProvider.System);
        for (int i = 0; i < 4; i++)
            control.RegistrarFallo(Correo);

        control.Reiniciar(Correo);
        control.RegistrarFallo(Correo);

        Assert.Null(control.TiempoBloqueoRestante(Correo));
    }
}
