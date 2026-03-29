# Consorcia — Gestión inteligente de edificios

Consorcia es una plataforma que automatiza la gestión de mantenimiento de edificios/consorcios en Argentina. Los supervisores reportan trabajos por **Telegram** (fotos, audios, texto), y el sistema organiza todo automáticamente, genera reportes profesionales con **inteligencia artificial**, y los envía por email a los propietarios.

**Demo en vivo:** [consorcia.vercel.app](https://consorcia.vercel.app)

---

## Cómo probarlo

### 1. Entrar como administrador

Ingresá a la app con estas credenciales:

| Campo | Valor |
|-------|-------|
| Email | `lucas@consorcia.app` |
| Password | `admin123` |

Desde el panel de admin podés ver todos los supervisores, edificios, trabajos y reportes.

### 2. Probar el bot de Telegram

Esta es la parte más importante de la demo. Para probarlo con tu propia cuenta de Telegram:

1. Logueate como **admin** en la web
2. Andá a **Supervisores** y elegí cualquier supervisor (ej: Carlos Méndez)
3. Editá el campo **Telegram ID** y poné tu propio ID de Telegram
   - Para saber tu ID, buscá `@userinfobot` en Telegram y mandale `/start`
4. Buscá el bot **@consorcia_bot** en Telegram
5. Mandá cualquier mensaje para arrancar

El bot te va a mostrar los edificios asignados a ese supervisor y vas a poder crear trabajos, completarlos, mandar fotos y audios — todo desde el chat.

> **Nota:** Usamos Telegram en vez de WhatsApp porque al ser un MVP, Telegram nos permite implementar un bot funcional gratis y al instante, sin costos de API ni procesos de aprobación. En producción se migraría a WhatsApp Business API, pero la experiencia del usuario sería idéntica.

### 3. Entrar como supervisor en la web

También podés ver el panel web de cada supervisor:

| Supervisor | Email | Password | Edificios |
|------------|-------|----------|-----------|
| Carlos Méndez | `carlos@consorcia.app` | `demo123` | 4 edificios, 11 trabajos completados |
| María López | `maria@consorcia.app` | `demo123` | 3 edificios, 8 trabajos completados |
| Roberto García | `roberto@consorcia.app` | `demo123` | 2 edificios, 6 trabajos completados |

---

## Qué hace cada parte

### Bot de Telegram (el corazón de la app)

El supervisor interactúa 100% desde Telegram. No necesita aprender nada nuevo ni instalar nada.

**Flujo de un trabajo nuevo:**
1. El bot le muestra sus edificios asignados y elige uno
2. Selecciona "Nuevo trabajo"
3. Manda las fotos del **antes** del arreglo y escribe "LISTO"
4. Describe el trabajo por texto o **audio de voz**
5. Si mandó audio, la IA lo **transcribe automáticamente** con Whisper en menos de 1 segundo
6. El trabajo queda registrado en el edificio correcto

**Cuando termina el arreglo:**
1. Selecciona "Completar trabajo pendiente"
2. Elige cuál de sus trabajos pendientes terminó
3. Manda las fotos del **después**
4. Opcionalmente carga el gasto (monto, proveedor, categoría)
5. El trabajo se marca como completado con fecha y hora

### Panel de Administrador

El admin tiene visibilidad y control total:

- **Dashboard** con métricas en tiempo real: cantidad de supervisores, edificios, trabajos pendientes y completados del mes
- **Gestión de supervisores**: crear, editar, ver detalle, asignar Telegram ID
- **Gestión de edificios**: crear, editar, asignar supervisor, configurar emails de destinatarios, subir logo
- **Ver todos los trabajos** de cualquier edificio con fotos antes/después, gastos y estado
- **Reclamos de inquilinos**: ver y gestionar problemas reportados por inquilinos via Telegram
- **Generar y enviar reportes** desde cualquier edificio

### Panel de Supervisor (web)

Cada supervisor tiene su propio dashboard con:

- **Métricas**: edificios asignados, trabajos pendientes, completados del mes, reportes generados
- **Insights con IA**: alertas inteligentes generadas automáticamente (ej: "El edificio X tiene 3x más problemas de plomería que el promedio")
- **Vista por edificio** con pestañas: Pendientes, Completados, Reclamos, Historial, Reportes, Destinatarios, Generar reporte

### Generación de Reportes con IA

El flujo completo en un solo lugar:

1. El supervisor o admin va a un edificio y clickea **Generar Reporte**
2. Selecciona qué trabajos del mes incluir
3. La IA (Claude) toma las descripciones informales y genera:
   - **Resumen ejecutivo** del mes
   - **Descripciones mejoradas** de cada trabajo con tono profesional (sin inventar datos)
   - **Resumen de gastos** con desglose por proveedor y categoría
   - **Párrafo de cierre** formal
4. Todo el texto es editable antes de confirmar
5. Se genera un **PDF profesional** con fotos antes/después, logo del edificio y datos del supervisor
6. Se configura el email: asunto, mensaje, destinatarios
7. Un click y se **envía por email** a todos los propietarios con el PDF adjunto

### Reclamos de Inquilinos

Los inquilinos también pueden usar el bot de Telegram:

- Describen el problema (texto o audio)
- Eligen categoría (plomería, electricidad, ascensor, limpieza, etc.) y nivel de urgencia
- Pueden adjuntar fotos
- El reclamo aparece en el panel del supervisor y del admin con su estado (pendiente, en progreso, resuelto, rechazado)

---

## Arquitectura de IA

La IA no es un feature decorativo. Es el motor de toda la operación:

| Punto de IA | Tecnología | Qué hace |
|-------------|-----------|----------|
| Transcripción de audio | Whisper via Groq | Convierte audios de voz en español a texto en <1 segundo |
| Generación de reportes | Claude (Anthropic) | Toma descripciones informales y genera informes profesionales completos |
| Insights automáticos | Análisis de datos + IA | Detecta patrones y genera alertas inteligentes por edificio |

---

## Stack técnico

| Componente | Tecnología |
|-----------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Bot | Telegram Bot API con webhook en Supabase Edge Function |
| Transcripción de audio | Whisper (Groq API) |
| Generación de texto | Claude (Anthropic API) |
| PDF | html2canvas + jsPDF (generación client-side) |
| Email | SMTP directo desde Edge Function |
| Hosting | Vercel (frontend) + Supabase (backend) |

### Edge Functions

| Función | Qué hace |
|---------|----------|
| `telegram-webhook` | Recibe mensajes de Telegram, maneja conversación stateful, sube fotos a storage, transcribe audios |
| `generate-report` | Llama a Claude para generar texto profesional del reporte mensual |
| `send-report` | Genera y envía el email con PDF adjunto via SMTP |
| `create-supervisor` | Crea usuario con auth + perfil + supervisor (requiere rol admin) |

---

## Estructura del proyecto

```
src/
  pages/           → Páginas (Landing, Login, Dashboard, Building, Report, Admin)
  components/      → Componentes de UI (InsightsPanel, JobDetailDialog, CreateJobForm, etc.)
  lib/             → Supabase client, auth context, generación de PDF, insights
  types/           → Tipos TypeScript
supabase/
  functions/       → Edge functions (telegram-webhook, generate-report, send-report)
  migrations/      → Migraciones SQL
```

---

## Por qué es negocio

- **Mercado**: +30,000 administraciones de consorcios solo en Argentina
- **Modelo**: SaaS mensual por administración, precio escalonado por cantidad de edificios
- **Costos operativos**: cercanos a cero — Unico gasto son los modelos de AI
- **Escalabilidad**: cada administración nueva es solo datos, no hay configuración custom
- **MVP real**: no es un mockup, funciona end-to-end — Telegram, transcripción, base de datos, dashboard, reportes con IA, envío de emails

---

**Consorcia** — El supervisor sigue haciendo lo mismo que hacía antes: mandar fotos y audios por chat. Pero ahora tiene un asistente de IA que organiza todo, genera reportes profesionales, y le da inteligencia sobre sus edificios.
