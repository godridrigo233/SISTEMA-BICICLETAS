import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, LifeBuoy, Mail, ShieldAlert, UserCheck } from 'lucide-react';
import { useSesion } from '../auth/SesionContext';
import { NOMBRE_ROL, ROL, RUTA_INICIO_POR_ROL } from '../../app/rutasPorRol';
import { CORREO_SOPORTE, enlaceSoporte } from '../../app/soporte';
import { GUIAS_POR_ROL } from './guias';

/**
 * Ayuda y Soporte (Práctica 11): guía rápida de las tareas del rol en sesión (Nielsen H10) y punto de entrada
 * de incidencias (ITIL 4): el reporte llega con el rol, la pantalla y la hora para registrarlo y clasificarlo.
 */
export default function AyudaPage() {
  const { sesion } = useSesion();
  const { hash, state } = useLocation();
  const nombreRol = NOMBRE_ROL[sesion?.idRol] ?? 'Usuario';
  const guia = GUIAS_POR_ROL[sesion?.idRol] ?? [];
  const pantalla = state?.desde ?? '—';
  const esPersonal = sesion?.idRol !== ROL.ESTUDIANTE;

  useEffect(() => {
    if (hash === '#soporte') document.getElementById('soporte')?.scrollIntoView?.({ behavior: 'smooth' });
  }, [hash]);

  return (
    <main className="contenido">
      {/* El Garitero no tiene menú lateral: este enlace lo devuelve a su pantalla (Nielsen H3, control y libertad). */}
      <Link className="enlace" to={RUTA_INICIO_POR_ROL[sesion?.idRol] ?? '/login'} style={{ display: 'inline-flex', gap: 6, marginBottom: 8 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Volver a mi pantalla de inicio
      </Link>
      <div className="encabezado">
        <h1>Ayuda y Soporte</h1>
        <p className="ayuda" style={{ marginTop: -8 }}>
          Guía rápida para el rol {nombreRol}. El detalle de cada tarea está en el Manual de Usuario.
        </p>
      </div>

      <section className="ficha" aria-labelledby="titulo-guia">
        <h2 id="titulo-guia" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={20} aria-hidden="true" /> Cómo realizar sus tareas
        </h2>
        {guia.map(({ tarea, pasos }) => (
          <article key={tarea} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 6px' }}>{tarea}</h3>
            <ol style={{ margin: 0, paddingLeft: 22 }}>
              {pasos.map((paso) => <li key={paso}>{paso}</li>)}
            </ol>
          </article>
        ))}
      </section>

      <section id="soporte" className="ficha" aria-labelledby="titulo-soporte" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
        <h2 id="titulo-soporte" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LifeBuoy size={20} aria-hidden="true" /> Soporte
        </h2>
        {esPersonal && (
          <p className="aviso" role="note" style={{ display: 'flex', gap: 8 }}>
            <ShieldAlert size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>
              Si la garita no puede registrar ingresos o retiros, no detenga la atención: aplique el protocolo de contingencia
              (plantilla o bitácora) y avise de inmediato al Supervisor de turno.
            </span>
          </p>
        )}
        <ol style={{ paddingLeft: 22 }}>
          <li style={{ marginBottom: 8 }}>
            <UserCheck size={16} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            Acuda al <strong>Supervisor de turno</strong> de la garita: resuelve las dudas de uso y escala el caso si hace falta.
          </li>
          <li>
            <Mail size={16} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            O escriba a la Dirección de Seguridad Institucional (<strong>{CORREO_SOPORTE}</strong>). El correo se abre con su rol,
            la pantalla y la hora; solo describa lo que ocurrió.
          </li>
        </ol>
        <a className="boton boton-primario" href={enlaceSoporte({ rol: nombreRol, pantalla })} style={{ display: 'inline-flex', gap: 8 }}>
          <Mail size={18} aria-hidden="true" /> Escribir a Soporte
        </a>
      </section>
    </main>
  );
}
