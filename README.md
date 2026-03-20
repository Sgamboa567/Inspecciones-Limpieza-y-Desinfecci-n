# Inspecciones de Limpieza y Desinfección (Google Apps Script)

## ¿Qué incluye esta versión?

- Formulario operativo con enlace QR por joyería (`?s=<id_joyeria>`).
- Autocarga del nombre/correo de la joyería cuando entra por QR.
- Fecha automática editable.
- Responsable con autocompletado por historial de registros de la joyería.
- Selección de múltiples **ÁREA(S)** preconfiguradas.
- Registro fotográfico, observaciones y firma digital.
- Panel admin (`?admin=1`) con:
  - KPIs (registradas / pendientes).
  - Filtro por mes y zona.
  - Gráficas de cumplimiento por joyería (barra de progreso).
  - Tabla de QR, link de formulario, y link directo de WhatsApp.
  - Envío masivo de QR por correo.
  - Carga/actualización de joyerías por CSV.

## Estructura de columnas esperada en la hoja `Registros`

Se guarda una fila por cada envío con este orden:

1. timestamp
2. fechaInspeccion
3. joyeriaId
4. joyeriaNombre
5. zona
6. responsable
7. correoJoyeria
8. areasJson
9. checklistJson
10. totalCumple
11. totalNoCumple
12. observaciones
13. photoUrls
14. signatureUrl
15. registradoPor

> Si ya tienes datos con una estructura anterior, migra o usa una hoja nueva para evitar cruces.

## Configuración rápida

1. En `Code.gs`, actualiza:
   - `SPREADSHEET_ID`
   - `BRAND_LOGO_URL` (usa URL directa de imagen en Drive: `https://drive.google.com/uc?export=view&id=FILE_ID`)
   - `ADMIN_EMAILS`
   - `INSPECTOR_EMAILS`
   - `JOYERIAS` (id, nombre, correo, zona, whatsapp)
   - `AREAS`
2. Crea/verifica la hoja `Registros` en tu Spreadsheet.
3. Deploy en Apps Script:
   - `Deploy > New deployment > Web app`
   - Ejecutar como: tú
   - Acceso: según política de tu organización
4. Copia la URL del Web App.
5. Si deseas cargar masivamente joyerías, entra a Admin y pega el CSV con encabezado:
   `joyeria,apoderado,sociedad_nombre,departamento,ciudad,zona`

## URLs de uso

- Formulario general: `https://.../exec`
- Formulario por QR de joyería: `https://.../exec?s=med-centro`
- Panel admin: `https://.../exec?admin=1`

> Apps Script abre el formulario por defecto (Index). Para entrar al panel administrativo debes agregar `?admin=1` a la URL desplegada.

## Flujo recomendado de operación

1. SST entra al panel admin.
2. Revisa dashboard por fecha/zona.
3. Envía QR masivo por correo con un clic.
4. Si una joyería usa WhatsApp, abre el link de la columna WhatsApp.
5. Cada sede registra inspección desde su QR.
6. SST monitorea pendientes y cumplimiento en el panel.

## Buenas prácticas

- Usa `id` cortos y estables por joyería (no cambiar).
- Guarda números WhatsApp en formato internacional sin símbolos (ej. `573001112233`).
- Programa `createMonthlyTrigger()` una sola vez para recordatorios mensuales.
- Ajusta permisos de despliegue para proteger panel admin.

## Funciones clave para ejecutar manualmente

- `createMonthlyTrigger()`
- `sendMonthlyReminder()`
- `sendMassiveQrEmails()` (solo admins)
