(() => {
  'use strict';

  const C = Object.assign(
    { nome: 'Aniversariante', data: '', apiUrl: '', siteUrl: '', pollSeconds: 15 },
    window.FESTA || {}
  );
  const DEMO = !C.apiUrl;
  const CHUNK = 4 * 1024 * 1024;           // múltiplo de 256 KB (exigência do Drive)
  const MAX_BYTES = 250 * 1024 * 1024;
  const $ = (s, r = document) => r.querySelector(s);
  const params = new URLSearchParams(location.search);
  const localPreview = new Map();          // fileId -> objectURL (o que eu mesmo enviei)

  /* ---------------- textos da festa ---------------- */
  document.querySelectorAll('[data-nome]').forEach(el => (el.textContent = C.nome));
  if (C.data) { const d = $('[data-data]'); d.textContent = C.data; d.hidden = false; }
  document.title = `O Reino Encantado da ${C.nome}`;
  $('#msgText').placeholder = `Escreva um recadinho para a ${C.nome}...`;
  if (DEMO) $('#demoBanner').hidden = false;

  /* ---------------- armazenamento local seguro ---------------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
  };

  /* ================================================================ */
  /* API                                                               */
  /* ================================================================ */
  const api = DEMO ? demoApi() : realApi();

  function realApi() {
    const parse = async res => {
      let j;
      try { j = await res.json(); } catch { throw new Error('Resposta inválida do servidor'); }
      if (!j.ok) throw new Error(j.error || 'Erro no servidor');
      return j;
    };
    return {
      list: () => fetch(`${C.apiUrl}?action=list&t=${Date.now()}`).then(parse).then(j => j.items),
      post: body => fetch(C.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
        body: JSON.stringify(body),
      }).then(parse),
    };
  }

  function demoApi() {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const now = Date.now();
    const items = [
      { id: 'd1', createdAt: now - 60000, type: 'message', author: 'Vovó', text: 'Parabéns, meu amor! Que seu primeiro aninho seja só o começo de muita alegria. 💖', frame: 'reino' },
      { id: 'd2', createdAt: now - 120000, type: 'message', author: 'Tio Pedro', text: 'Feliz aniversário, pequena! Muita saúde e muitos sorrisos!', frame: 'ceu' },
      { id: 'd3', createdAt: now - 180000, type: 'message', author: 'Dinda', text: 'Um ano de muito amor! Te amo demais 🎂', frame: 'princesa' },
      { id: 'd4', createdAt: now - 240000, type: 'message', author: 'Primo Lucas', text: 'Parabéns, Laurinha!', frame: 'none' },
    ];
    const uploads = {};
    let n = 0;
    return {
      async list() { await wait(300); return items.slice().sort((a, b) => b.createdAt - a.createdAt); },
      async post(b) {
        await wait(250 + Math.random() * 300);
        if (b.action === 'message') {
          const item = { id: 'm' + ++n, createdAt: Date.now(), type: 'message', author: b.author || 'Convidado', text: b.text, frame: b.frame };
          items.push(item); return { ok: true, item };
        }
        if (b.action === 'start') {
          const id = 'u' + ++n; uploads[id] = { ...b, received: 0 }; return { ok: true, uploadId: id };
        }
        if (b.action === 'chunk') {
          const u = uploads[b.uploadId];
          u.received = b.start + Math.floor(b.data.length * 3 / 4);
          if (u.received < u.size) return { ok: true, done: false };
          const item = { id: 'f' + ++n, createdAt: Date.now(), type: u.mime.startsWith('video/') ? 'video' : 'photo',
            author: u.author || 'Convidado', text: '', fileId: 'demo_' + n, mime: u.mime };
          items.push(item); return { ok: true, done: true, item };
        }
        throw new Error('Ação inválida');
      },
    };
  }

  async function retry(fn, tries = 3) {
    let err;
    for (let i = 0; i < tries; i++) {
      try { return await fn(); } catch (e) { err = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    throw err;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  async function uploadFile(file, author, onProgress) {
    const start = await retry(() => api.post({ action: 'start', name: file.name, mime: file.type, size: file.size, author }));
    let offset = 0, last = null;
    onProgress(0);
    while (offset < file.size) {
      const part = file.slice(offset, offset + CHUNK);
      const data = await blobToBase64(part);
      const at = offset;
      last = await retry(() => api.post({ action: 'chunk', uploadId: start.uploadId, start: at, data }));
      offset += part.size;
      onProgress(offset / file.size);
    }
    if (!last || !last.done) throw new Error('Envio incompleto');
    return last.item;
  }

  /* ================================================================ */
  /* Preparação de arquivos                                            */
  /* ================================================================ */
  const EXT_MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime',
    webm: 'video/webm', '3gp': 'video/3gpp', m4v: 'video/x-m4v', mkv: 'video/x-matroska',
  };
  function fixMime(file) {
    if (file.type) return file;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const type = EXT_MIME[ext];
    return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
  }

  // Reduz fotos grandes (2560px) para o envio ficar rápido no 4G da festa.
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const max = 2560;
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 3 * 1024 * 1024) { bmp.close && bmp.close(); return file; }
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close && bmp.close();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } catch {
      return file; // navegador não conseguiu ler (ex.: HEIC no Chrome) — envia o original
    }
  }

  /* ================================================================ */
  /* Envio — UI                                                        */
  /* ================================================================ */
  const authorInput = $('#author');
  authorInput.value = store.get('festa_autor') || '';
  authorInput.addEventListener('change', () => store.set('festa_autor', authorInput.value.trim()));
  const getAuthor = () => authorInput.value.trim();

  function requireAuthor() {
    if (getAuthor()) return true;
    toast('Coloque seu nome antes de enviar 😊');
    authorInput.focus();
    return false;
  }

  // Mensagem
  const msgForm = $('#msgForm'), msgText = $('#msgText'), msgToggle = $('#msgToggle');
  msgToggle.addEventListener('click', () => {
    msgForm.hidden = !msgForm.hidden;
    msgToggle.setAttribute('aria-expanded', String(!msgForm.hidden));
    if (!msgForm.hidden) msgText.focus();
  });
  msgText.addEventListener('input', () => { $('#msgCount').textContent = `${msgText.value.length}/1000`; updateMsgPreview(); });

  // Moldura do recado: prévia ao vivo + opções
  let msgFrame = store.get('festa_moldura_msg') || 'reino';
  const msgPreview = $('#msgPreview'), msgFrameOpts = $('#msgFrames');
  function updateMsgPreview() {
    messageCard({
      id: 'preview', frame: msgFrame,
      text: msgText.value.trim() || 'Seu recadinho aparece assim no mural 💖',
      author: getAuthor() || 'Seu nome',
    }, msgPreview);
  }
  msgFrameOpts.querySelectorAll('.mf-opt').forEach(b => b.addEventListener('click', () => {
    msgFrame = b.dataset.id;
    store.set('festa_moldura_msg', msgFrame);
    msgFrameOpts.querySelectorAll('.mf-opt').forEach(o => {
      o.classList.toggle('active', o === b);
      o.setAttribute('aria-checked', String(o === b));
    });
    updateMsgPreview();
  }));
  (msgFrameOpts.querySelector(`.mf-opt[data-id="${msgFrame}"]`) || msgFrameOpts.querySelector('.mf-opt')).click();
  authorInput.addEventListener('input', updateMsgPreview);
  msgForm.addEventListener('submit', async e => {
    e.preventDefault();
    const text = msgText.value.trim();
    if (!text) { msgText.focus(); return; }
    if (!requireAuthor()) return;
    store.set('festa_autor', getAuthor());
    const btn = msgForm.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const { item } = await retry(() => api.post({ action: 'message', author: getAuthor(), text, frame: msgFrame }));
      msgText.value = ''; $('#msgCount').textContent = '0/1000'; updateMsgPreview();
      msgForm.hidden = true; msgToggle.setAttribute('aria-expanded', 'false');
      addItems([item]);
      celebrate('Seu recadinho chegou no Reino! 💌');
    } catch (err) {
      toast('Não foi possível enviar: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar mensagem';
    }
  });

  // Fotos e vídeos
  const fileInput = $('#fileInput');
  $('label[for=fileInput]').addEventListener('click', e => {
    if (!requireAuthor()) e.preventDefault();
  });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    store.set('festa_autor', getAuthor());
    const author = getAuthor();
    const photos = [];
    files.map(fixMime).forEach(f => {
      if (f.type.startsWith('image/') && f.type !== 'image/gif' && window.Molduras) photos.push(f);
      else enqueue(f, author);           // vídeos vão direto (sem moldura)
    });
    if (photos.length) openFramePicker(photos, author);
  });

  /* ---------------- Escolha de moldura ---------------- */
  const fp = $('#framePicker'), fpCanvas = $('#fpCanvas'), fpOptions = $('#fpOptions');
  const fpSend = $('#fpSend'), fpLoading = $('#fpLoading');
  let fpState = null;
  if (window.Molduras) Molduras.preload();

  function loadBitmap(file) {
    if ('createImageBitmap' in window) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImgEl(file));
    }
    return loadImgEl(file);
  }
  function loadImgEl(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  function showCanvas(target, source) {
    target.width = source.width; target.height = source.height;
    target.getContext('2d').drawImage(source, 0, 0);
  }

  async function openFramePicker(photos, author) {
    let preview;
    try { preview = await loadBitmap(photos[0]); }
    catch { photos.forEach(f => enqueue(f, author)); return; } // navegador não abre a foto: envia sem moldura

    const saved = store.get('festa_moldura');
    const chosen = Molduras.list.some(f => f.id === saved) ? saved : 'reino';
    fpState = { photos, author, preview, chosen, token: Symbol() };
    $('#fpCount').hidden = photos.length < 2;
    $('#fpCount').textContent = `A moldura vai para as ${photos.length} fotos`;
    fpSend.textContent = photos.length > 1 ? `Enviar ${photos.length} fotos` : 'Enviar foto';
    fpSend.disabled = false;
    fp.hidden = false;
    document.body.style.overflow = 'hidden';

    // opções com miniatura da própria foto
    fpOptions.innerHTML = '';
    for (const f of Molduras.list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fp-opt'; b.dataset.id = f.id;
      b.setAttribute('role', 'radio');
      const c = document.createElement('canvas');
      const label = document.createElement('span'); label.textContent = f.nome;
      b.append(c, label);
      b.addEventListener('click', () => selectFrame(f.id));
      fpOptions.append(b);
      const token = fpState.token;
      Molduras.render(preview, f.id, 260).then(cv => { if (fpState && fpState.token === token) showCanvas(c, cv); });
    }
    selectFrame(chosen);
  }

  async function selectFrame(id) {
    if (!fpState) return;
    fpState.chosen = id;
    fpOptions.querySelectorAll('.fp-opt').forEach(b => {
      const on = b.dataset.id === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    fpLoading.hidden = false;
    const token = fpState.token;
    const cv = await Molduras.render(fpState.preview, id, 900);
    if (!fpState || fpState.token !== token || fpState.chosen !== id) return;
    showCanvas(fpCanvas, cv);
    fpLoading.hidden = true;
  }

  function closeFramePicker() {
    fp.hidden = true;
    document.body.style.overflow = '';
    if (fpState && fpState.preview.close) fpState.preview.close();
    fpState = null;
  }
  $('#fpClose').addEventListener('click', closeFramePicker);
  fp.addEventListener('click', e => { if (e.target === fp) closeFramePicker(); });

  fpSend.addEventListener('click', async () => {
    if (!fpState) return;
    const { photos, author, chosen } = fpState;
    store.set('festa_moldura', chosen);
    fpSend.disabled = true;
    fpSend.textContent = 'Aplicando moldura...';
    const framed = [];
    for (const file of photos) {
      if (chosen === 'none') { framed.push(file); continue; }
      try {
        const bmp = await loadBitmap(file);
        const cv = await Molduras.render(bmp, chosen, 2048);
        if (bmp.close) bmp.close();
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
        const name = file.name.replace(/\.[^.]+$/, '') + '-moldura.jpg';
        framed.push(blob ? new File([blob], name, { type: 'image/jpeg' }) : file);
      } catch {
        framed.push(file);
      }
    }
    closeFramePicker();
    framed.forEach(f => enqueue(f, author));
  });

  const queueEl = $('#queue');
  const queue = [];
  let busy = false;

  function enqueue(rawFile, author) {
    const file = fixMime(rawFile);
    const li = document.createElement('li');
    const isVideo = file.type.startsWith('video/');
    let thumb;
    if (file.type.startsWith('image/')) {
      thumb = document.createElement('img');
      thumb.src = URL.createObjectURL(file);
    } else {
      thumb = document.createElement('div');
      thumb.textContent = isVideo ? '▶' : '?';
    }
    thumb.className = 'q-thumb';
    li.innerHTML = '<div class="q-info"><div class="q-name"></div><div class="q-status">Na fila...</div><div class="q-bar"><i></i></div></div>';
    li.prepend(thumb);
    li.querySelector('.q-name').textContent = file.name || (isVideo ? 'vídeo' : 'foto');
    queueEl.prepend(li);

    const job = { file, author, li };
    if (!/^(image|video)\//.test(file.type)) return failJob(job, 'Só fotos e vídeos');
    if (file.size > MAX_BYTES) return failJob(job, 'Arquivo muito grande (máx. 250 MB)');
    if (!file.size) return failJob(job, 'Arquivo vazio');
    queue.push(job);
    pump();
  }

  function failJob(job, msg, canRetry) {
    job.li.className = 'error';
    const st = job.li.querySelector('.q-status');
    st.textContent = msg;
    if (canRetry) {
      const b = document.createElement('button');
      b.className = 'q-retry'; b.type = 'button'; b.textContent = 'Tentar de novo';
      b.onclick = () => { job.li.className = ''; st.textContent = 'Na fila...'; queue.push(job); pump(); };
      st.append(' ', b);
    }
  }

  async function pump() {
    if (busy) return;
    busy = true;
    let sent = { photo: 0, video: 0 };
    while (queue.length) {
      const job = queue.shift();
      const st = job.li.querySelector('.q-status'), bar = job.li.querySelector('.q-bar > i');
      try {
        st.textContent = 'Preparando...';
        const file = job.file.type.startsWith('image/') ? await shrinkImage(job.file) : job.file;
        st.textContent = 'Enviando... 0%';
        const item = await uploadFile(file, job.author, p => {
          bar.style.width = (p * 100).toFixed(0) + '%';
          st.textContent = `Enviando... ${(p * 100).toFixed(0)}%`;
        });
        if (item.fileId) localPreview.set(item.fileId, URL.createObjectURL(file));
        job.li.className = 'done';
        st.textContent = 'Enviado! 🎉';
        addItems([item]);
        sent[item.type === 'video' ? 'video' : 'photo']++;
        setTimeout(() => job.li.remove(), 6000);
      } catch (err) {
        failJob(job, 'Falhou: ' + err.message, true);
      }
    }
    busy = false;
    const total = sent.photo + sent.video;
    if (total) {
      const what = total > 1 ? 'Suas lembranças chegaram' : (sent.video ? 'Seu vídeo chegou' : 'Sua foto chegou');
      celebrate(`${what} no Reino! 📸`);
    }
  }

  /* ================================================================ */
  /* Mural                                                             */
  /* ================================================================ */
  let items = [];
  let filter = 'all';
  let onItemsChanged = () => {};           // substituído pelo modo telão
  const nodes = new Map();
  const grid = $('#grid');

  function addItems(newOnes) {
    const byId = new Map(items.map(i => [i.id, i]));
    newOnes.forEach(i => i && byId.set(i.id, i));
    setItems(Array.from(byId.values()));
  }

  function setItems(list) {
    items = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    render();
    onItemsChanged();
  }

  function thumbUrl(fileId, size) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }
  function altUrl(fileId, size) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${size}`;
  }

  // Carrega a miniatura do Drive com plano B e novas tentativas (fotos recém-enviadas demoram um pouco).
  function loadDriveImg(img, item, size, onGiveUp) {
    const local = localPreview.get(item.fileId);
    if (local) { img.src = local; return; }
    if (DEMO) { onGiveUp(); return; }
    let attempt = 0;
    const urls = () => [thumbUrl(item.fileId, size), altUrl(item.fileId, size)];
    img.onerror = () => {
      attempt++;
      if (attempt === 1) { img.src = urls()[1]; return; }
      if (attempt < 6) { setTimeout(() => { img.src = urls()[attempt % 2] + '&r=' + attempt; }, 8000 * attempt); return; }
      img.onerror = null; onGiveUp();
    };
    img.src = urls()[0];
  }

  function colorIndex(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 4; }

  function msgFrameOf(item) {
    return ['none', 'reino', 'ceu', 'princesa'].includes(item.frame) ? item.frame : 'reino';
  }

  // cartão de recado com a moldura escolhida (usado no mural e na prévia do formulário)
  function messageCard(item, el = document.createElement('article')) {
    el.className = `tile message f-${msgFrameOf(item)} c${colorIndex(item.id)}`;
    el.innerHTML = '<span class="deco deco-a"></span><span class="deco deco-b"></span><span class="deco deco-c"></span>';
    const p = document.createElement('p'); p.textContent = item.text;
    const f = document.createElement('footer'); f.textContent = '— ' + item.author;
    el.append(p, f);
    return el;
  }

  function makeNode(item) {
    if (item.type === 'message') return messageCard(item);
    const fig = document.createElement('figure');
    fig.className = 'tile ' + item.type;
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = (item.type === 'video' ? 'Vídeo' : 'Foto') + ' de ' + item.author;
    fig.append(img);
    loadDriveImg(img, item, 600, () => {
      const ph = document.createElement('div');
      ph.className = 'placeholder' + (item.type === 'photo' ? ' photo-ph' : '');
      ph.textContent = item.type === 'video' ? '' : 'Foto';
      img.replaceWith(ph);
    });
    if (item.type === 'video') { const pl = document.createElement('span'); pl.className = 'play'; fig.append(pl); }
    const cap = document.createElement('figcaption'); cap.textContent = item.author;
    fig.append(cap);
    fig.addEventListener('click', () => openLightbox(item));
    return fig;
  }

  let lastSig = '';
  function render() {
    const visible = items.filter(i => filter === 'all' || i.type === filter);
    const sig = filter + '|' + visible.map(i => i.id).join(',');
    $('#loading').hidden = true;
    $('#empty').hidden = visible.length > 0;
    const counts = { photo: 0, video: 0, message: 0 };
    items.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
    const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
    $('#count').textContent = items.length
      ? [pl(counts.photo, 'foto', 'fotos'), pl(counts.video, 'vídeo', 'vídeos'), pl(counts.message, 'recado', 'recados')].join(' · ')
      : '';
    if (sig === lastSig) return;
    lastSig = sig;
    const keep = new Set(visible.map(i => i.id));
    for (const [id, el] of nodes) if (!items.some(i => i.id === id)) { el.remove(); nodes.delete(id); }
    for (const [id, el] of nodes) if (!keep.has(id)) el.remove();
    visible.forEach(item => {
      let el = nodes.get(item.id);
      if (!el) { el = makeNode(item); nodes.set(item.id, el); }
      grid.append(el);
    });
  }

  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    filter = chip.dataset.filter;
    render();
  }));

  /* ---------------- Lightbox ---------------- */
  const lb = $('#lightbox'), lbBody = lb.querySelector('.lb-body'), lbCap = lb.querySelector('.lb-caption');
  function openLightbox(item) {
    lbBody.innerHTML = '';
    const local = localPreview.get(item.fileId);
    if (item.type === 'photo') {
      const img = document.createElement('img');
      img.alt = 'Foto de ' + item.author;
      if (local) img.src = local; else loadDriveImg(img, item, 2000, () => {});
      lbBody.append(img);
    } else if (local || DEMO) {
      const v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.autoplay = true; if (local) v.src = local;
      lbBody.append(v);
    } else {
      const f = document.createElement('iframe');
      f.src = `https://drive.google.com/file/d/${encodeURIComponent(item.fileId)}/preview`;
      f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true;
      lbBody.append(f);
    }
    lbCap.textContent = (item.type === 'video' ? 'Vídeo de ' : 'Foto de ') + item.author;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { lb.hidden = true; lbBody.innerHTML = ''; document.body.style.overflow = ''; }
  lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb || e.target === lbBody) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  /* ---------------- Botão flutuante "Enviar" ---------------- */
  const fab = $('#fab'), sendCard = $('.send');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      fab.hidden = e.isIntersecting || params.has('telao');
    }).observe(sendCard);
  }
  fab.addEventListener('click', () => {
    sendCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!getAuthor()) setTimeout(() => authorInput.focus({ preventScroll: true }), 400);
  });

  /* ---------------- Agradecimento da aniversariante ---------------- */
  const thanks = $('#thanks');
  let thanksTimer;
  function celebrate(text) {
    $('#thanksText').textContent = text;
    thanks.hidden = false;
    clearTimeout(thanksTimer);
    thanksTimer = setTimeout(() => (thanks.hidden = true), 3200);
  }
  thanks.addEventListener('click', () => { clearTimeout(thanksTimer); thanks.hidden = true; });

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }

  /* ---------------- Atualização periódica ---------------- */
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const list = await api.list();
      setItems(list);
    } catch (err) {
      if (!items.length) $('#loading').textContent = 'Não foi possível carregar o mural. Tentando de novo...';
    } finally { loading = false; }
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, Math.max(5, C.pollSeconds) * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  /* ================================================================ */
  /* Telão  (abra o site com ?telao no final do endereço)              */
  /* ================================================================ */
  if (params.has('telao')) startTelao();

  function startTelao() {
    $('#app').hidden = true;
    $('#telao').hidden = false;
    document.body.classList.add('telao-mode');

    const url = C.siteUrl || (location.origin + location.pathname);
    if (window.QRCode) {
      new QRCode($('#qr'), { text: url, width: 240, height: 240, colorDark: '#4a3566', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }

    const stage = $('#stage');
    const seen = new Set();
    const fresh = [];
    let idx = 0, first = true, timer = null, current = null;

    onItemsChanged = () => {
      items.forEach(i => {
        if (!seen.has(i.id)) { seen.add(i.id); if (!first) fresh.push(i); }
      });
      first = false;
      const n = items.length;
      $('#telaoCount').textContent = n ? `${n} ${n === 1 ? 'lembrança enviada' : 'lembranças enviadas'}` : '';
      if (!timer) next();
    };

    function next() {
      clearTimeout(timer); timer = null;
      if (!items.length) {
        stage.innerHTML = '<div class="slide show"><div class="telao-empty"><img src="img/carruagem.webp" alt="" style="width:260px;display:block;margin:0 auto 16px">Esperando as primeiras fotos... 📸</div></div>';
        return;
      }
      const item = fresh.shift() || items[idx++ % items.length];
      build(item).then(slide => {
        stage.append(slide);
        requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.add('show')));
        const old = current; current = slide;
        if (old) { old.classList.remove('show'); setTimeout(() => old.remove(), 1200); }
        timer = setTimeout(next, item.type === 'message' ? 10000 : 8000);
      }).catch(() => { timer = setTimeout(next, 1500); });
    }

    function build(item) {
      return new Promise((resolve, reject) => {
        const slide = document.createElement('div');
        if (item.type === 'message') {
          const fr = msgFrameOf(item);
          slide.className = `slide msg-slide msg-${fr}`;
          if (fr !== 'none') {
            const crown = new Image(); crown.src = 'img/coroa.webp'; crown.className = 'slide-crown'; crown.alt = '';
            slide.append(crown);
          }
          const q = document.createElement('blockquote');
          q.textContent = '“' + item.text + '”';
          const c = document.createElement('cite'); c.textContent = '— ' + item.author;
          q.append(c); slide.append(q);
          return resolve(slide);
        }
        slide.className = 'slide';
        const img = new Image();
        img.className = 'main';
        img.onload = () => {
          const bg = document.createElement('div'); bg.className = 'bg';
          bg.style.backgroundImage = `url("${img.src}")`;
          slide.append(bg, img);
          if (item.type === 'video') {
            const pl = document.createElement('span'); pl.className = 'play';
            slide.append(pl);
          }
          const who = document.createElement('div'); who.className = 'who';
          who.textContent = (item.type === 'video' ? '🎬 ' : '📸 ') + item.author;
          slide.append(who);
          resolve(slide);
        };
        img.onerror = reject;
        const local = localPreview.get(item.fileId);
        if (local) img.src = local;
        else if (DEMO) reject();
        else img.src = thumbUrl(item.fileId, 1600);
      });
    }
  }
})();
