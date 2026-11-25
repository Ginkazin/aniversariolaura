/**
 * Backend do site de aniversário — Google Apps Script.
 *
 * - Fotos e vídeos vão para uma pasta no Google Drive.
 * - Mensagens e o índice do mural ficam numa planilha dentro dessa pasta.
 *
 * Como usar (detalhes no LEIAME.md):
 *   1. Cole este arquivo em https://script.google.com (novo projeto).
 *   2. Rode a função `setup` uma vez e autorize.
 *   3. Implantar > Nova implantação > App da Web
 *        Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *   4. Copie a URL (termina em /exec) para o config.js do site.
 *
 * Para tirar algo do mural: apague a linha correspondente na planilha.
 */

const NOME_PASTA = 'Aniversário - fotos, vídeos e mensagens';
const MAX_BYTES = 250 * 1024 * 1024; // 250 MB por arquivo
const CACHE_LISTA_SEG = 8;           // cache curto da lista do mural

const PROPS = PropertiesService.getScriptProperties();
const CACHE = CacheService.getScriptCache();

/* ------------------------------------------------------------------ */
/* Configuração inicial — rode UMA vez pelo editor                     */
/* ------------------------------------------------------------------ */
function setup() {
  let folderId = PROPS.getProperty('FOLDER_ID');
  if (!folderId) {
    const folder = DriveApp.createFolder(NOME_PASTA);
    folderId = folder.getId();
    PROPS.setProperty('FOLDER_ID', folderId);
  }
  const folder = DriveApp.getFolderById(folderId);
  try {
    // Necessário para as fotos aparecerem no mural para os convidados.
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('ATENÇÃO: não foi possível compartilhar a pasta por link. ' +
      'Se for conta de empresa/escola, use uma conta Gmail pessoal. Erro: ' + e);
  }

  let sheetId = PROPS.getProperty('SHEET_ID');
  if (!sheetId) {
    const ss = SpreadsheetApp.create('Mural do aniversário');
    const sh = ss.getSheets()[0];
    sh.setName('Itens');
    sh.appendRow(['id', 'criadoEm', 'tipo', 'autor', 'texto', 'fileId', 'mime', 'arquivo']);
    sh.setFrozenRows(1);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    sheetId = ss.getId();
    PROPS.setProperty('SHEET_ID', sheetId);
  }

  Logger.log('Tudo pronto!');
  Logger.log('Pasta:    https://drive.google.com/drive/folders/' + folderId);
  Logger.log('Planilha: https://docs.google.com/spreadsheets/d/' + sheetId);
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                            */
/* ------------------------------------------------------------------ */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'list') return json_({ ok: true, items: listItems_() });
    return json_({ ok: true, msg: 'API do aniversário funcionando' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'message': return json_(addMessage_(body));
      case 'start':   return json_(startUpload_(body));
      case 'chunk':   return json_(uploadChunk_(body));
    }
    throw new Error('Ação inválida');
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ------------------------------------------------------------------ */
/* Mural                                                                */
/* ------------------------------------------------------------------ */
function listItems_() {
  const cached = CACHE.get('lista');
  if (cached) return JSON.parse(cached);

  const values = sheet_().getDataRange().getValues();
  const items = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    items.push({
      id: String(r[0]),
      createdAt: Number(r[1]),
      type: String(r[2]),
      author: String(r[3]),
      text: String(r[4]),
      fileId: String(r[5]),
      mime: String(r[6]),
    });
  }
  items.sort((a, b) => b.createdAt - a.createdAt);

  const str = JSON.stringify(items);
  if (str.length < 90000) CACHE.put('lista', str, CACHE_LISTA_SEG);
  return items;
}

function addItem_(item) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Apóstrofo na frente impede que textos como "=..." virem fórmula na planilha.
    const txt = v => "'" + String(v || '');
    sheet_().appendRow([item.id, item.createdAt, item.type, txt(item.author), txt(item.text),
      item.fileId || '', item.mime || '', txt(item.fileName)]);
    CACHE.remove('lista');
  } finally {
    lock.releaseLock();
  }
  return item;
}

function addMessage_(b) {
  const text = clean_(b.text, 1000);
  if (!text) throw new Error('Mensagem vazia');
  const item = addItem_({
    id: Utilities.getUuid(),
    createdAt: Date.now(),
    type: 'message',
    author: clean_(b.author, 60) || 'Convidado',
    text: text,
  });
  return { ok: true, item: item };
}

/* ------------------------------------------------------------------ */
/* Upload em partes (resumable upload do Drive)                         */
/* O navegador manda o arquivo em pedaços de 4 MB; cada pedaço é        */
/* repassado para o Drive. Assim vídeos grandes também funcionam.       */
/* ------------------------------------------------------------------ */
function startUpload_(b) {
  const size = Number(b.size);
  if (!(size > 0)) throw new Error('Arquivo vazio');
  if (size > MAX_BYTES) throw new Error('Arquivo muito grande (máx. 250 MB)');
  const mime = String(b.mime || '');
  if (!/^(image|video)\//.test(mime)) throw new Error('Só é possível enviar fotos e vídeos');

  const author = clean_(b.author, 60) || 'Convidado';
  const extMatch = String(b.name || '').match(/\.[a-z0-9]{2,5}$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm.ss');
  const fileName = stamp + ' - ' + author.replace(/[\\/:*?"<>|]/g, '') + ext;

  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,mimeType', {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size),
      },
      payload: JSON.stringify({ name: fileName, parents: [folderId_()], mimeType: mime }),
      muteHttpExceptions: true,
    });
  if (res.getResponseCode() !== 200) {
    throw new Error('Falha ao iniciar envio (' + res.getResponseCode() + ')');
  }
  const headers = res.getAllHeaders();
  let location = '';
  Object.keys(headers).forEach(k => { if (k.toLowerCase() === 'location') location = headers[k]; });
  if (!location) throw new Error('Drive não retornou o endereço de envio');

  const uploadId = Utilities.getUuid();
  CACHE.put('up_' + uploadId, JSON.stringify({
    location: location, size: size, mime: mime, author: author, fileName: fileName,
  }), 21600);
  return { ok: true, uploadId: uploadId };
}

function uploadChunk_(b) {
  const raw = CACHE.get('up_' + b.uploadId);
  if (!raw) throw new Error('Envio expirado, tente de novo');
  const info = JSON.parse(raw);

  const bytes = Utilities.base64Decode(String(b.data || ''));
  const start = Number(b.start);
  const end = start + bytes.length - 1;

  const res = UrlFetchApp.fetch(info.location, {
    method: 'put',
    contentType: info.mime,
    payload: bytes,
    headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + info.size },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();

  if (code === 308) return { ok: true, done: false };

  if (code === 200 || code === 201) {
    const file = JSON.parse(res.getContentText());
    CACHE.remove('up_' + b.uploadId);
    const item = addItem_({
      id: Utilities.getUuid(),
      createdAt: Date.now(),
      type: info.mime.indexOf('video/') === 0 ? 'video' : 'photo',
      author: info.author,
      text: '',
      fileId: file.id,
      mime: info.mime,
      fileName: info.fileName,
    });
    return { ok: true, done: true, item: item };
  }
  throw new Error('Erro no envio (' + code + ')');
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                          */
/* ------------------------------------------------------------------ */
function folderId_() {
  const id = PROPS.getProperty('FOLDER_ID');
  if (!id) throw new Error('Rode a função setup() no editor do Apps Script primeiro');
  return id;
}

function sheet_() {
  const id = PROPS.getProperty('SHEET_ID');
  if (!id) throw new Error('Rode a função setup() no editor do Apps Script primeiro');
  return SpreadsheetApp.openById(id).getSheetByName('Itens');
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
