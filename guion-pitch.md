# Guion de Video — Consorcia
**Duración:** 3:00 minutos | **Categoría:** IA y Automatización

---

## PRIMER ACTO — EL DOLOR (0:00 - 0:40)

Son las 7 de la mañana. Carlos es supervisor de edificios en Buenos Aires. Hoy tiene 12 edificios que recorrer, 15 llamadas que va a recibir, y un cuaderno donde anota todo. Cuando arregla una canilla, le saca una foto y la manda por WhatsApp a un grupo. Cuando cambia una cerradura, lo mismo. A fin de mes tiene 300 fotos mezcladas en 12 chats distintos, y tiene que armar un informe para cada edificio. A mano. Juntando foto por foto, recordando qué hizo y cuándo.

¿Y los propietarios? Se quejan igual. "No sabemos qué se hizo en el edificio este mes."

Esto no es un caso inventado. El 70% de las administraciones de consorcios en Argentina todavía gestionan mantenimiento con papel, cuadernos y WhatsApp informal. Estamos hablando de una industria de más de 30.000 administraciones que opera como en los '90.

---

## SEGUNDO ACTO — LA SOLUCIÓN (0:40 - 1:30)

¿Y si todo eso se hiciera solo?

Consorcia. El supervisor no cambia nada de lo que ya hace. Sigue mandando fotos y audios, pero ahora a un bot de Telegram.

[MOSTRAR PANTALLA: Chat de Telegram con el bot — supervisor seleccionando edificio]

Paso uno: manda las fotos del antes, graba un audio de 10 segundos diciendo "Arreglé la pérdida de agua en el 3B de Rivadavia". Listo.

[MOSTRAR PANTALLA: Bot confirmando el trabajo creado con la transcripción]

Paso dos: la IA transcribe el audio al instante, registra el trabajo en el edificio correcto, y guarda las fotos organizadas. Sin tocar nada más.

[MOSTRAR PANTALLA: Dashboard del supervisor con métricas y lista de edificios]

Paso tres: cuando termina el arreglo, manda las fotos del después y el bot lo marca como completado.

[MOSTRAR PANTALLA: Vista del edificio con trabajos completados y fotos antes/después]

Paso cuatro: a fin de mes, un click genera un reporte profesional escrito por IA con todos los trabajos, fotos de antes y después, y un resumen ejecutivo.

[MOSTRAR PANTALLA: Preview del reporte generado con texto de IA]

Paso cinco: otro click manda ese reporte por email a todos los propietarios.

[MOSTRAR PANTALLA: Pantalla de envío con destinatarios y preview del email]

El supervisor sigue haciendo exactamente lo mismo que antes. Pero ahora todo se organiza solo.

---

## TERCER ACTO — LA IA EN ACCIÓN (1:30 - 2:15)

Acá es donde Consorcia se diferencia. La IA no es un feature más — es el motor de toda la operación. Cada interacción pasa por inteligencia artificial.

**Primero: transcripción de audio.** Usamos Whisper a través de Groq. El supervisor graba un audio en español y en menos de un segundo tenemos el texto. Sin que toque un teclado.

[MOSTRAR PANTALLA: Mensaje de audio en Telegram → respuesta del bot con transcripción]

**Segundo: bot conversacional inteligente.** El supervisor interactúa con lenguaje natural por Telegram. El bot maneja estado, entiende contexto, y guía al supervisor paso a paso sin menús complicados.

**Tercero: análisis de imágenes.** Las fotos que manda el supervisor se almacenan automáticamente categorizadas como "antes" y "después", vinculadas al trabajo y al edificio correcto.

**Cuarto: generación de reportes.** Claude toma todos los trabajos del mes — descripciones, fechas, gastos — y genera un informe formal y coherente. No copia y pega: reescribe cada descripción con tono profesional y arma un resumen ejecutivo.

[MOSTRAR PANTALLA: Reporte generado mostrando summary + descripciones mejoradas]

**Quinto: insights automáticos.** El dashboard analiza los datos y genera alertas inteligentes. "El edificio Rivadavia tiene 3 veces más problemas de plomería que el promedio." Eso es inteligencia de gestión que hoy no existe en esta industria.

[MOSTRAR PANTALLA: Panel de Insights en el dashboard]

---

## CUARTO ACTO — POR QUÉ ES NEGOCIO (2:15 - 2:45)

El mercado: más de 30.000 administraciones de consorcios solo en Argentina. Cada una maneja entre 5 y 50 edificios.

El modelo: SaaS por administración, precio escalonado por cantidad de edificios. La operación escala sin costo: cada administración nueva es solo datos, no hay nada custom que hacer.

Y el costo operativo es mínimo. Groq nos da transcripción gratuita en su free tier. El email sale por Gmail SMTP. La infraestructura corre en Supabase. Estamos hablando de costos cercanos a cero hasta escalar.

Lo más importante: esto no es un mockup. Es un MVP que funciona end-to-end. Telegram, transcripción, base de datos, dashboard, reportes con IA, envío de emails. Todo conectado. Todo funcionando.

---

## CIERRE (2:45 - 3:00)

Carlos sigue haciendo lo mismo que hacía antes. Manda fotos, graba audios, sigue con su día. Pero ahora tiene un asistente de inteligencia artificial que organiza todo automáticamente, genera reportes profesionales con un click, y le da visibilidad real sobre lo que pasa en sus edificios.

**Consorcia — gestión inteligente de edificios.**

---

## SHOTS RECOMENDADOS

| Timestamp | Shot | Pantalla/Recurso |
|-----------|------|-------------------|
| 0:00-0:10 | Intro del dolor | B-roll: supervisor con cuaderno, teléfono con WhatsApp lleno de fotos |
| 0:10-0:40 | Contexto del problema | Texto animado con estadísticas, fotos desordenadas en galería |
| 0:40-0:50 | Transición a solución | Logo de Consorcia + tagline |
| 0:50-1:00 | Flujo Telegram | Grabación de pantalla: chat con bot, selección de edificio, envío de fotos |
| 1:00-1:10 | Audio → Transcripción | Grabación de pantalla: envío de audio en Telegram, respuesta del bot con texto |
| 1:10-1:20 | Dashboard | Grabación de pantalla: métricas, lista de edificios, navegación |
| 1:20-1:30 | Reporte + Email | Grabación de pantalla: generación de reporte, preview, pantalla de envío |
| 1:30-1:45 | Whisper / Groq | Split screen: audio → texto en tiempo real, highlight de la velocidad |
| 1:45-1:55 | Bot conversacional | Grabación de pantalla: flujo completo de crear trabajo por Telegram |
| 1:55-2:05 | Reporte con IA | Grabación de pantalla: comparación descripción original vs. mejorada por Claude |
| 2:05-2:15 | Insights | Grabación de pantalla: panel de insights con alertas inteligentes |
| 2:15-2:45 | Modelo de negocio | Slides con números: mercado, modelo SaaS, costos, stack |
| 2:45-3:00 | Cierre | Logo + tagline + pantalla del dashboard como fondo |
