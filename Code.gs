/**********************
 * CONFIGURACIÓN
 **********************/
const CONFIG = {
  SPREADSHEET_ID: '17D6liGwLTdxe3W4GM5VQznuPKa3E-sactge4gWT02q4',
  SHEET_NAME: 'Registros',
  DRIVE_FOLDER_NAME: 'Inspecciones Limpieza y Desinfección',
  ADMIN_EMAILS: [
    'sgamboa765@gmail.com',
    'deudaspresuntas.aynn@gmail.com'
  ],
  INSPECTOR_EMAILS: [
    'inspector1@tudominio.com',
    'inspector2@tudominio.com'
  ],
  JOYERIAS: [
    'Joyería Medellín Centro',
    'Joyería Bogotá Norte',
    'Joyería Cali Sur'
  ],
  AREAS: [
    'Vitrinas',
    'Caja',
    'Bodega',
    'Oficina',
    'Baño',
    'Zona de atención',
    'Área común'
  ],
  CHECKLIST_ITEMS: [
    'Pisos limpios y desinfectados',
    'Superficies limpias',
    'Vitrinas desinfectadas',
    'Puestos de trabajo organizados',
    'Canecas limpias y con bolsa',
    'Elementos de aseo disponibles',
    'Baño limpio y desinfectado',
    'Se evidencia correcto manejo de residuos',
    'No hay derrames o suciedad visible',
    'Se cumple protocolo de limpieza SST'
  ]
};

/**********************
 * WEB APP
 **********************/
function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.data = {
    joyerias: CONFIG.JOYERIAS,
    areas: CONFIG.AREAS,
    checklist: CONFIG.CHECKLIST_ITEMS
  };
  return template.evaluate().setTitle('Formato Limpieza y desinfección');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getFormData_() {
  return {
    joyerias: CONFIG.JOYERIAS,
    areas: CONFIG.AREAS,
    checklist: CONFIG.CHECKLIST_ITEMS
  };
}

/**********************
 * SEGURIDAD / ROLES
 **********************/
function getUserRole(email) {
  if (!email) return 'anonymous';
  const normalized = email.toLowerCase().trim();

  if (CONFIG.ADMIN_EMAILS.map(e => e.toLowerCase()).includes(normalized)) {
    return 'admin';
  }

  if (CONFIG.INSPECTOR_EMAILS.map(e => e.toLowerCase()).includes(normalized)) {
    return 'inspector';
  }

  return 'guest';
}

/**********************
 * ENVÍO DE FORMULARIO
 **********************/
function saveInspection(payload) {
  try {
    validatePayload_(payload);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error(`No existe la hoja: ${CONFIG.SHEET_NAME}`);
    }

    const parentFolder = getOrCreateFolder_(CONFIG.DRIVE_FOLDER_NAME);
    const monthFolder = getOrCreateSubFolder_(parentFolder, getMonthFolderName_(new Date()));
    const inspectionFolder = monthFolder.createFolder(
      sanitizeName_(`${payload.joyeria} - ${payload.responsable} - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}`)
    );

    // Guardar fotos
    const photoUrls = [];
    if (payload.photos && payload.photos.length) {
      payload.photos.forEach((photo, index) => {
        const blob = base64ToBlob_(photo.base64, photo.fileName || `foto_${index + 1}.jpg`, photo.mimeType || 'image/jpeg');
        const file = inspectionFolder.createFile(blob);
        photoUrls.push(file.getUrl());
      });
    }

    // Guardar firma
    let signatureUrl = '';
    if (payload.signatureBase64) {
      const sigBlob = base64ToBlob_(payload.signatureBase64, 'firma_responsable.png', 'image/png');
      const sigFile = inspectionFolder.createFile(sigBlob);
      signatureUrl = sigFile.getUrl();
    }

    const checklistJson = JSON.stringify(payload.checklist || []);
    const totalCumple = (payload.checklist || []).filter(i => i.estado === 'Cumple').length;
    const totalNoCumple = (payload.checklist || []).filter(i => i.estado === 'No cumple').length;

    const row = [
      new Date(),
      payload.fechaInspeccion,
      payload.joyeria,
      payload.area,
      payload.responsable,
      payload.correo,
      checklistJson,
      totalCumple,
      totalNoCumple,
      payload.observaciones || '',
      photoUrls.join(' | '),
      signatureUrl,
      payload.registradoPor || payload.correo || 'Sin dato'
    ];

    sheet.appendRow(row);

    sendNotificationEmail_(payload, photoUrls, signatureUrl);

    return {
      ok: true,
      message: 'Inspección guardada correctamente'
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}

/**********************
 * VALIDACIONES
 **********************/
function validatePayload_(payload) {
  if (!payload) throw new Error('No llegaron datos del formulario.');
  if (!payload.fechaInspeccion) throw new Error('La fecha de inspección es obligatoria.');
  if (!payload.joyeria) throw new Error('La joyería es obligatoria.');
  if (!payload.area) throw new Error('El área es obligatoria.');
  if (!payload.responsable) throw new Error('El nombre del responsable es obligatorio.');
  if (!payload.correo) throw new Error('El correo es obligatorio.');
  if (!payload.checklist || !payload.checklist.length) throw new Error('Debes diligenciar el checklist.');
  if (!payload.signatureBase64) throw new Error('La firma es obligatoria.');
}

/**********************
 * CORREO
 **********************/
function sendNotificationEmail_(payload, photoUrls, signatureUrl) {
  const recipients = CONFIG.ADMIN_EMAILS.join(',');
  if (!recipients) return;

  const subject = `Nueva inspección de limpieza - ${payload.joyeria} - ${payload.fechaInspeccion}`;

  const checklistHtml = (payload.checklist || [])
    .map(item => `<li><b>${escapeHtml_(item.item)}:</b> ${escapeHtml_(item.estado)}</li>`)
    .join('');

  const photosHtml = photoUrls.length
    ? `<p><b>Fotos:</b><br>${photoUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>')}</p>`
    : '<p><b>Fotos:</b> No se adjuntaron</p>';

  const signatureHtml = signatureUrl
    ? `<p><b>Firma:</b><br><a href="${signatureUrl}" target="_blank">Ver firma</a></p>`
    : '';

  const htmlBody = `
    <h2>Inspección de Limpieza y Desinfección</h2>
    <p><b>Fecha:</b> ${escapeHtml_(payload.fechaInspeccion)}</p>
    <p><b>Joyería:</b> ${escapeHtml_(payload.joyeria)}</p>
    <p><b>Área:</b> ${escapeHtml_(payload.area)}</p>
    <p><b>Responsable:</b> ${escapeHtml_(payload.responsable)}</p>
    <p><b>Correo:</b> ${escapeHtml_(payload.correo)}</p>
    <p><b>Observaciones:</b> ${escapeHtml_(payload.observaciones || 'Sin observaciones')}</p>
    <p><b>Checklist:</b></p>
    <ul>${checklistHtml}</ul>
    ${photosHtml}
    ${signatureHtml}
  `;

  MailApp.sendEmail({
    to: recipients,
    subject: subject,
    htmlBody: htmlBody
  });
}

/**********************
 * RECORDATORIO MENSUAL
 **********************/
function sendMonthlyReminder() {
  const webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) {
    throw new Error('Primero debes desplegar la Web App para obtener la URL.');
  }

  const subject = 'Recordatorio mensual - Inspección de limpieza y desinfección';
  const body = `
Hola equipo,

Este es el recordatorio mensual para diligenciar el formato de limpieza y desinfección en las áreas de trabajo.

Por favor ingresen al siguiente enlace:
${webAppUrl}

Gracias.
`;

  const recipients = [...new Set([...CONFIG.ADMIN_EMAILS, ...CONFIG.INSPECTOR_EMAILS])].join(',');

  if (recipients) {
    MailApp.sendEmail(recipients, subject, body);
  }
}

/**
 * Ejecuta una sola vez esta función para crear el trigger mensual.
 * Queda programado el día 1 de cada mes a las 8 AM.
 */
function createMonthlyTrigger() {
  // Eliminar triggers previos del mismo proceso para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendMonthlyReminder') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('sendMonthlyReminder')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
}

/**********************
 * UTILIDADES DRIVE
 **********************/
function getOrCreateFolder_(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}

function getMonthFolderName_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function base64ToBlob_(base64Data, fileName, mimeType) {
  const cleanBase64 = base64Data.replace(/^data:.*;base64,/, '');
  const bytes = Utilities.base64Decode(cleanBase64);
  return Utilities.newBlob(bytes, mimeType, fileName);
}

function sanitizeName_(name) {
  return name.replace(/[\\/:*?"<>|#%{}~&]/g, '-');
}

function escapeHtml_(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


function probarDatos() {
  Logger.log(JSON.stringify({
    joyerias: CONFIG.JOYERIAS,
    areas: CONFIG.AREAS,
    checklist: CONFIG.CHECKLIST_ITEMS
  }, null, 2));
}
