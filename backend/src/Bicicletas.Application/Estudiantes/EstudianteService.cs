using Bicicletas.Application.Comun;
using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Biometria;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Estudiantes;

/// <summary>CU-01: registro de la bicicleta y enrolamiento facial del estudiante (W4).</summary>
public sealed class EstudianteService(IEstudianteRepositorio repositorio, TimeProvider reloj)
{
    private static readonly string[] TiposMovimiento = ["INGRESO", "RETIRO"];

    public async Task<PerfilEstudianteResponse> ObtenerPerfilAsync(Guid idEstudiante, CancellationToken ct) =>
        await repositorio.ObtenerPerfilAsync(idEstudiante, ct)
        ?? throw new RecursoNoEncontradoException("La cuenta no está vinculada al padrón de estudiantes.");

    public async Task<BicicletaPropiaResponse> RegistrarBicicletaAsync(Guid idEstudiante, RegistrarBicicletaRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        await ObtenerPerfilAsync(idEstudiante, ct);
        string marco = solicitud.NumeroMarco.Trim().ToUpperInvariant();
        if (await repositorio.ExisteNumeroMarcoAsync(marco, ct))
            throw new ConflictoEstadoException("El número de marco ya está registrado. Si es un error, acuda a la jefatura de vigilancia.");

        Bicicleta bicicleta = Bicicleta.Registrar(idEstudiante, marco, solicitud.MarcaModelo, solicitud.Color, solicitud.RasgosDistintivos);
        repositorio.AgregarBicicleta(bicicleta);
        await repositorio.GuardarAsync(ct);
        return new BicicletaPropiaResponse(bicicleta.IdBicicleta, bicicleta.CodigoQr, bicicleta.NumeroMarco,
            bicicleta.MarcaModelo, bicicleta.Color, bicicleta.RasgosDistintivos, "FUERA");
    }

    public async Task EnrolarAsync(Guid idEstudiante, EnrolamientoRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!solicitud.ConsentimientoAceptado)
            throw new ValidacionNegocioException("Debe aceptar el consentimiento para el tratamiento del descriptor biométrico (Ley N.º 29733).");
        if (solicitud.Descriptor is null || solicitud.Descriptor.Length != PoliticaBiometrica.Dimensiones || !solicitud.Descriptor.All(double.IsFinite))
            throw new ValidacionNegocioException($"El descriptor debe tener exactamente {PoliticaBiometrica.Dimensiones} valores numéricos.");
        await ObtenerPerfilAsync(idEstudiante, ct);

        DateTime ahora = reloj.GetUtcNow().UtcDateTime;
        DescriptorBiometrico? actual = await repositorio.ObtenerDescriptorAsync(idEstudiante, ct);
        if (actual is null)
            repositorio.AgregarDescriptor(DescriptorBiometrico.Crear(idEstudiante, solicitud.Descriptor, solicitud.VersionModelo, ahora));
        else
            actual.Actualizar(solicitud.Descriptor, solicitud.VersionModelo, ahora);
        await repositorio.GuardarAsync(ct);
    }

    /// <summary>W5: el filtro por estudiante lo impone el servidor con el «sub» del JWT (OWASP A01).</summary>
    public async Task<Pagina<MovimientoHistorialResponse>> ConsultarHistorialAsync(Guid idEstudiante, FiltroMovimientos filtro, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(filtro);
        var (desde, hasta) = filtro.RangoUtc();
        TipoEvento? tipo = FiltroMovimientos.Validar(filtro.Tipo, "tipo", TiposMovimiento) switch
        {
            "INGRESO" => TipoEvento.Ingreso,
            "RETIRO" => TipoEvento.Retiro,
            _ => null,
        };
        var (total, elementos) = await repositorio.ConsultarHistorialAsync(idEstudiante, tipo, desde, hasta,
            (filtro.Pagina - 1) * filtro.Tamano, filtro.Tamano, ct);
        return new Pagina<MovimientoHistorialResponse>(total, filtro.Pagina, filtro.Tamano, elementos);
    }
}
