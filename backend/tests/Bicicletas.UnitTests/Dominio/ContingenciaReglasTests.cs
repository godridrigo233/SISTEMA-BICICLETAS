using Bicicletas.Application.Contingencias;
using Bicicletas.Application.Usuarios;
using Bicicletas.Domain.Comun;

namespace Bicicletas.UnitTests.Dominio;

public class ContingenciaReglasTests
{
    [Fact]
    public void LectorCsv_AceptaBomComaYFilasVacias()
    {
        var filas = LectorCsvContingencias.Leer("﻿Folio,Fecha_Hora,Tipo,Codigo,DNI,Vigilante\r\nE-1,16/10/2026 10:15,INGRESO,ABC,,\r\n,,,,,\r\n");
        var (numero, datos) = Assert.Single(filas);
        Assert.Equal(2, numero);
        Assert.Equal("E-1", datos.Folio);
        Assert.Null(datos.Dni);
    }

    [Theory]
    [InlineData("")]
    [InlineData("folio;fecha;tipo")]
    [InlineData("folio;fecha_hora;tipo;codigo;dni;vigilante")]
    public void LectorCsv_RechazaArchivoSinEncabezadoOSinFilas(string contenido)
    {
        Assert.Throws<ValidacionNegocioException>(() => LectorCsvContingencias.Leer(contenido));
    }

    [Fact]
    public void ContrasenaTemporal_TieneLetrasYDigitos_YCambiaCadaVez()
    {
        string a = GestionUsuariosService.GenerarTemporal();
        Assert.Equal(12, a.Length);
        Assert.Contains(a, char.IsDigit);
        Assert.Contains(a, char.IsLetter);
        Assert.NotEqual(a, GestionUsuariosService.GenerarTemporal());
    }
}
