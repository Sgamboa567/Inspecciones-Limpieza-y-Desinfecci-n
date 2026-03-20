/**********************
 * CONFIGURACIÓN
 **********************/
const CONFIG = {
  SPREADSHEET_ID: '17D6liGwLTdxe3W4GM5VQznuPKa3E-sactge4gWT02q4',
  SHEET_NAME: 'Registros',
  DRIVE_FOLDER_NAME: 'Inspecciones Limpieza y Desinfección',
  BRAND_LOGO_URL: 'https://drive.google.com/uc?export=view&id=REEMPLAZAR_ID_ARCHIVO_LOGO',
  JOYERIAS_STORE_KEY: 'JOYERIAS_JSON',
  ADMIN_EMAILS: [
    'sgamboa765@gmail.com',
    'deudaspresuntas.aynn@gmail.com'
  ],
  INSPECTOR_EMAILS: [
    'inspector1@tudominio.com',
    'inspector2@tudominio.com'
  ],
  JOYERIAS: [
    {
      id: 'med-centro',
      nombre: 'Joyería Medellín Centro',
      correo: 'medellin.centro@joyeria.com',
      apoderado: '',
      sociedad_nombre: '',
      departamento: 'Antioquia',
      ciudad: 'Medellín',
      zona: 'Antioquia',
      whatsapp: '573001112233'
    },
    {
      id: 'bog-norte',
      nombre: 'Joyería Bogotá Norte',
      correo: 'bogota.norte@joyeria.com',
      apoderado: '',
      sociedad_nombre: '',
      departamento: 'Bogotá D.C.',
      ciudad: 'Bogotá D.C.',
      zona: 'Cundinamarca',
      whatsapp: '573004445566'
    },
    {
      id: 'cali-sur',
      nombre: 'Joyería Cali Sur',
      correo: 'cali.sur@joyeria.com',
      apoderado: '',
      sociedad_nombre: '',
      departamento: 'Valle del Cauca',
      ciudad: 'Cali',
      zona: 'Valle del Cauca',
      whatsapp: '573007778899'
    }
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
function doGet(e) {
  const mode = (e && e.parameter && e.parameter.admin === '1') ? 'admin' : 'form';

  if (mode === 'admin') {
    const template = HtmlService.createTemplateFromFile('Admin');
    template.data = {
      isAdmin: isCurrentUserAdmin_(),
      dashboard: getDashboardData_(),
      qrCatalog: getQrCatalog_(),
      joyerias: getJoyerias_(),
      webAppUrl: ScriptApp.getService().getUrl() || '',
      logoUrl: CONFIG.BRAND_LOGO_URL
    };
    return template.evaluate().setTitle('Panel Admin SST');
  }

  const joyeriaId = e && e.parameter ? (e.parameter.s || '').trim() : '';
  const joyeria = joyeriaId ? getJoyeriaById_(joyeriaId) : null;

  const template = HtmlService.createTemplateFromFile('Index');
  template.data = {
    joyerias: getJoyerias_(),
    areas: CONFIG.AREAS,
    checklist: CONFIG.CHECKLIST_ITEMS,
    selectedJoyeriaId: joyeria ? joyeria.id : '',
    selectedJoyeriaName: joyeria ? joyeria.nombre : '',
    selectedJoyeriaEmail: joyeria ? joyeria.correo : '',
    logoUrl: CONFIG.BRAND_LOGO_URL
  };
  return template.evaluate().setTitle('Formato Limpieza y Desinfección');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getFormData_() {
  return {
    joyerias: getJoyerias_(),
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

function isCurrentUserAdmin_() {
  try {
    const email = Session.getActiveUser().getEmail() || '';
    return getUserRole(email) === 'admin';
  } catch (err) {
    return false;
  }
}

/**********************
 * DATOS DINÁMICOS
 **********************/
function getJoyeriaById_(id) {
  return getJoyerias_().find(j => j.id === id) || null;
}

function getJoyerias_() {
  const raw = PropertiesService.getScriptProperties().getProperty(CONFIG.JOYERIAS_STORE_KEY);
  if (!raw) return CONFIG.JOYERIAS;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : CONFIG.JOYERIAS;
  } catch (err) {
    return CONFIG.JOYERIAS;
  }
}

function getResponsablesByJoyeria(joyeriaId) {
  if (!joyeriaId) return [];

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const set = {};
  rows.slice(1).forEach(r => {
    if (String(r[2] || '') === joyeriaId && r[5]) {
      set[String(r[5]).trim()] = true;
    }
  });

  return Object.keys(set).sort();
}

/**********************
 * ENVÍO DE FORMULARIO
 **********************/
function saveInspection(payload) {
  try {
    validatePayload_(payload);

    const joyeria = getJoyeriaById_(payload.joyeriaId);
    if (!joyeria) {
      throw new Error('No se encontró la joyería seleccionada.');
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error(`No existe la hoja: ${CONFIG.SHEET_NAME}`);
    }

    const parentFolder = getOrCreateFolder_(CONFIG.DRIVE_FOLDER_NAME);
    const monthFolder = getOrCreateSubFolder_(parentFolder, getMonthFolderName_(new Date()));
    const inspectionFolder = monthFolder.createFolder(
      sanitizeName_(`${joyeria.nombre} - ${payload.responsable} - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}`)
    );

    const photoUrls = [];
    if (payload.photos && payload.photos.length) {
      payload.photos.forEach((photo, index) => {
        const blob = base64ToBlob_(photo.base64, photo.fileName || `foto_${index + 1}.jpg`, photo.mimeType || 'image/jpeg');
        const file = inspectionFolder.createFile(blob);
        photoUrls.push(file.getUrl());
      });
    }

    let signatureUrl = '';
    if (payload.signatureBase64) {
      const sigBlob = base64ToBlob_(payload.signatureBase64, 'firma_responsable.png', 'image/png');
      const sigFile = inspectionFolder.createFile(sigBlob);
      signatureUrl = sigFile.getUrl();
    }

    const checklistJson = JSON.stringify(payload.checklist || []);
    const areasJson = JSON.stringify(payload.areas || []);
    const totalCumple = (payload.checklist || []).filter(i => i.estado === 'Cumple').length;
    const totalNoCumple = (payload.checklist || []).filter(i => i.estado === 'No cumple').length;

    const row = [
      new Date(),
      payload.fechaInspeccion,
      joyeria.id,
      joyeria.nombre,
      joyeria.zona,
      payload.responsable,
      joyeria.correo,
      areasJson,
      checklistJson,
      totalCumple,
      totalNoCumple,
      payload.observaciones || '',
      photoUrls.join(' | '),
      signatureUrl,
      payload.registradoPor || joyeria.correo || 'Sin dato'
    ];

    sheet.appendRow(row);

    sendNotificationEmail_(payload, joyeria, photoUrls, signatureUrl);

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
 * DASHBOARD ADMIN
 **********************/
function getDashboardData(filter) {
  return getDashboardData_(filter || {});
}

function getDashboardData_(filter) {
  const zone = (filter && filter.zone) || '';
  const month = (filter && filter.month) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  const joyerias = getJoyerias_();

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const rows = (sheet && sheet.getLastRow() > 1) ? sheet.getDataRange().getValues().slice(1) : [];

  const joyeriasFiltradas = joyerias.filter(j => !zone || j.zona === zone);
  const joyeriasMap = {};
  joyeriasFiltradas.forEach(j => joyeriasMap[j.id] = j);

  const byDate = rows.filter(r => String(r[1] || '').startsWith(month) && joyeriasMap[r[2]]);
  const registradasSet = {};
  byDate.forEach(r => { registradasSet[r[2]] = true; });

  const registradas = Object.keys(registradasSet).length;
  const total = joyeriasFiltradas.length;
  const pendientes = Math.max(total - registradas, 0);

  const complianceByJoyeria = joyeriasFiltradas.map(j => {
    const jRows = byDate.filter(r => r[2] === j.id);
    const totalCumple = jRows.reduce((acc, r) => acc + Number(r[9] || 0), 0);
    const totalNoCumple = jRows.reduce((acc, r) => acc + Number(r[10] || 0), 0);
    const totalEvaluado = totalCumple + totalNoCumple;
    const porcentaje = totalEvaluado ? Math.round((totalCumple / totalEvaluado) * 100) : 0;
    return {
      joyeriaId: j.id,
      joyeria: j.nombre,
      zona: j.zona,
      cumplimiento: porcentaje,
      registros: jRows.length
    };
  });

  return {
    month,
    zone,
    zones: [...new Set(joyerias.map(j => j.zona))],
    total,
    registradas,
    pendientes,
    complianceByJoyeria
  };
}

function getQrCatalog_() {
  const webAppUrl = ScriptApp.getService().getUrl() || '';
  return getJoyerias_().map(j => {
    const formUrl = `${webAppUrl}?s=${encodeURIComponent(j.id)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(formUrl)}`;
    const waMessage = encodeURIComponent(`Hola ${j.nombre}, este es su enlace de inspección de limpieza y desinfección: ${formUrl}`);
    const whatsappUrl = j.whatsapp ? `https://wa.me/${j.whatsapp}?text=${waMessage}` : '';

    return {
      ...j,
      formUrl,
      qrUrl,
      whatsappUrl
    };
  });
}

function saveJoyeriasCsv(csvText) {
  if (!isCurrentUserAdmin_()) throw new Error('No autorizado.');
  if (!csvText || !csvText.trim()) throw new Error('Debes enviar el CSV.');

  const parsed = Utilities.parseCsv(csvText.trim());
  if (parsed.length < 2) throw new Error('CSV sin datos.');

  const header = parsed[0].map(h => h.trim().toLowerCase());
  const idx = {
    joyeria: header.indexOf('joyeria'),
    apoderado: header.indexOf('apoderado'),
    sociedad_nombre: header.indexOf('sociedad_nombre'),
    departamento: header.indexOf('departamento'),
    ciudad: header.indexOf('ciudad'),
    zona: header.indexOf('zona')
  };
  if (idx.joyeria < 0) throw new Error('El CSV debe incluir la columna "joyeria".');

  const data = parsed.slice(1).filter(r => r[idx.joyeria] && r[idx.joyeria].trim()).map(r => {
    const nombre = (r[idx.joyeria] || '').trim();
    return {
      id: slugify_(nombre),
      nombre: nombre,
      apoderado: idx.apoderado >= 0 ? (r[idx.apoderado] || '').trim() : '',
      sociedad_nombre: idx.sociedad_nombre >= 0 ? (r[idx.sociedad_nombre] || '').trim() : '',
      departamento: idx.departamento >= 0 ? (r[idx.departamento] || '').trim() : '',
      ciudad: idx.ciudad >= 0 ? (r[idx.ciudad] || '').trim() : '',
      zona: idx.zona >= 0 ? (r[idx.zona] || '').trim() : '',
      correo: '',
      whatsapp: ''
    };
  });

  PropertiesService.getScriptProperties().setProperty(CONFIG.JOYERIAS_STORE_KEY, JSON.stringify(data));
  return { ok: true, total: data.length };
}

function getQrCatalog() {
  if (!isCurrentUserAdmin_()) throw new Error('No autorizado.');
  return getQrCatalog_();
}

function sendMassiveQrEmails() {
  if (!isCurrentUserAdmin_()) throw new Error('No autorizado.');

  const catalog = getQrCatalog_();
  let sent = 0;

  catalog.forEach(item => {
    if (!item.correo) return;

    const htmlBody = `
      <p>Hola equipo de <b>${escapeHtml_(item.nombre)}</b>,</p>
      <p>Comparto su enlace personalizado para el registro de inspección de limpieza y desinfección:</p>
      <p><a href="${item.formUrl}">${item.formUrl}</a></p>
      <p>También pueden usar este QR:</p>
      <p><img src="${item.qrUrl}" alt="QR ${escapeHtml_(item.nombre)}" /></p>
      <p>Gracias.</p>
    `;

    MailApp.sendEmail({
      to: item.correo,
      subject: `Enlace y QR de inspección - ${item.nombre}`,
      htmlBody
    });

    sent += 1;
  });

  return { ok: true, sent };
}

/**********************
 * VALIDACIONES
 **********************/
function validatePayload_(payload) {
  if (!payload) throw new Error('No llegaron datos del formulario.');
  if (!payload.fechaInspeccion) throw new Error('La fecha de inspección es obligatoria.');
  if (!payload.joyeriaId) throw new Error('La joyería es obligatoria.');
  if (!payload.areas || !payload.areas.length) throw new Error('Debes seleccionar al menos un ÁREA.');
  if (!payload.responsable) throw new Error('El nombre del responsable es obligatorio.');
  if (!payload.checklist || !payload.checklist.length) throw new Error('Debes diligenciar el checklist.');
  if (!payload.signatureBase64) throw new Error('La firma es obligatoria.');
}

/**********************
 * CORREO
 **********************/
function sendNotificationEmail_(payload, joyeria, photoUrls, signatureUrl) {
  const recipients = CONFIG.ADMIN_EMAILS.join(',');
  if (!recipients) return;

  const subject = `Nueva inspección de limpieza - ${joyeria.nombre} - ${payload.fechaInspeccion}`;

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
    <p><b>Joyería:</b> ${escapeHtml_(joyeria.nombre)}</p>
    <p><b>Correo joyería:</b> ${escapeHtml_(joyeria.correo || 'Sin correo')}</p>
    <p><b>ZONA:</b> ${escapeHtml_(joyeria.zona || 'Sin zona')}</p>
    <p><b>ÁREA(S):</b> ${escapeHtml_((payload.areas || []).join(', '))}</p>
    <p><b>Responsable:</b> ${escapeHtml_(payload.responsable)}</p>
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

function slugify_(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
