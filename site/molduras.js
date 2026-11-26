/* ============================================================
 *  Molduras do Reino Encantado
 *  Desenha a moldura em volta da foto num <canvas>.
 *  Uso: await Molduras.render(imagemOuBitmap, 'reino', 2048) -> canvas
 * ============================================================ */
(() => {
  'use strict';
  const C = window.FESTA || {};
  const NOME = C.nome || 'Aniversariante';
  const DATA = C.data || '';

  const LIST = [
    { id: 'none', nome: 'Sem moldura' },
    { id: 'reino', nome: 'Reino' },
    { id: 'ceu', nome: 'Céu estrelado' },
    { id: 'princesa', nome: 'Princesa' },
  ];

  /* ---------- carregamento das imagens do tema ---------- */
  const cache = {};
  function asset(name) {
    if (!cache[name]) {
      cache[name] = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `img/${name}.webp`;
      });
    }
    return cache[name];
  }
  async function assets(names) {
    const out = {};
    await Promise.all(names.map(async n => { try { out[n] = await asset(n); } catch { out[n] = null; } }));
    return out;
  }
  let fontsReady = null;
  function fonts() {
    if (!fontsReady) {
      fontsReady = (document.fonts && document.fonts.load)
        ? Promise.all([document.fonts.load('700 40px Fredoka'), document.fonts.load('600 40px Fredoka')]).catch(() => {})
        : Promise.resolve();
    }
    return fontsReady;
  }

  /* ---------- utilitários de desenho ---------- */
  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // desenha uma imagem pela altura (h) ou largura (w), com rotação opcional
  function sticker(ctx, img, cx, cy, { h, w, rot = 0, shadow = 'rgba(0,0,0,.18)' }) {
    if (!img) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const dw = w || h * ratio, dh = h || w / ratio;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.shadowColor = shadow;
    ctx.shadowBlur = dh * 0.06;
    ctx.shadowOffsetY = dh * 0.03;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return { w: dw, h: dh };
  }

  // texto centralizado que encolhe até caber na largura
  function fitText(ctx, text, cx, cy, maxW, size, { weight = 700, color, stroke, strokeW = 0, shadow } = {}) {
    let s = size;
    do { ctx.font = `${weight} ${s}px Fredoka, Nunito, sans-serif`; s *= 0.94; } while (ctx.measureText(text).width > maxW && s > 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = s * 0.25; ctx.shadowOffsetY = s * 0.06; }
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.strokeText(text, cx, cy); }
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  function sparkle(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  function drawPhoto(ctx, src, x, y, w, h, r, ring) {
    ctx.save();
    ctx.shadowColor = 'rgba(60,30,90,.25)';
    ctx.shadowBlur = r * 1.2;
    ctx.shadowOffsetY = r * 0.3;
    roundRect(ctx, x - ring, y - ring, w + ring * 2, h + ring * 2, r + ring);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(src, x, y, w, h);
    ctx.restore();
  }

  /* ---------- definição de cada moldura ---------- */
  // pad: espaço em volta da foto, em fração do menor lado da foto
  const STYLES = {
    reino: {
      pad: { top: 0.17, side: 0.06, bottom: 0.27 },
      need: ['coroa', 'estrela', 'castelo', 'unicornio'],
      draw(ctx, A, L) {
        const { CW, CH, m, px, py, pw, ph } = L;
        const g = ctx.createLinearGradient(0, 0, CW, CH);
        g.addColorStop(0, '#ffb3d9'); g.addColorStop(0.5, '#d2bcff'); g.addColorStop(1, '#a9dcff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
        const rnd = rng(7);
        for (let i = 0; i < 70; i++) {
          ctx.globalAlpha = 0.35 + rnd() * 0.4;
          ctx.fillStyle = ['#fff', '#fff6d6', '#ffe1f0'][i % 3];
          ctx.beginPath(); ctx.arc(rnd() * CW, rnd() * CH, m * (0.004 + rnd() * 0.006), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // filete dourado
        ctx.save();
        ctx.strokeStyle = 'rgba(232,185,60,.9)'; ctx.lineWidth = m * 0.006;
        roundRect(ctx, m * 0.02, m * 0.02, CW - m * 0.04, CH - m * 0.04, m * 0.05); ctx.stroke();
        ctx.restore();

        drawPhoto(ctx, L.src, px, py, pw, ph, m * 0.03, m * 0.012);

        sticker(ctx, A.coroa, CW / 2, py - m * 0.06, { w: m * 0.3, rot: -0.04 });
        sticker(ctx, A.estrela, px + m * 0.01, py + m * 0.01, { h: m * 0.09, rot: -0.3 });
        sticker(ctx, A.estrela, px + pw - m * 0.01, py + m * 0.02, { h: m * 0.07, rot: 0.3 });
        sparkle(ctx, m * 0.09, m * 0.08, m * 0.025, '#fff');
        sparkle(ctx, CW - m * 0.1, m * 0.1, m * 0.02, '#fff6c9');

        const bandY = py + ph, bandH = CH - bandY;
        const castle = sticker(ctx, A.castelo, px + m * 0.1, bandY + bandH * 0.52, { h: bandH * 0.8, rot: -0.05 });
        const uni = sticker(ctx, A.unicornio, px + pw - m * 0.11, bandY + bandH * 0.5, { h: bandH * 0.78, rot: 0.04 });
        const left = px + m * 0.1 + (castle ? castle.w / 2 : 0);
        const right = px + pw - m * 0.11 - (uni ? uni.w / 2 : 0);
        const cx = (left + right) / 2, maxW = (right - left) * 0.96;
        fitText(ctx, NOME, cx, bandY + bandH * 0.4, maxW, m * 0.1,
          { color: '#f06aaa', stroke: '#fff', strokeW: m * 0.016, shadow: 'rgba(143,106,232,.35)' });
        fitText(ctx, DATA ? `1 aninho • ${DATA}` : '1 aninho', cx, bandY + bandH * 0.72, maxW, m * 0.042,
          { weight: 600, color: '#5b3a8c' });
      },
    },

    ceu: {
      pad: { top: 0.09, side: 0.07, bottom: 0.33 },
      need: ['estrela', 'logo-reino'],
      draw(ctx, A, L) {
        const { CW, CH, m, px, py, pw, ph } = L;
        const g = ctx.createLinearGradient(0, 0, 0, CH);
        g.addColorStop(0, '#1d1135'); g.addColorStop(0.55, '#33195a'); g.addColorStop(1, '#4b2777');
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
        const glow = ctx.createRadialGradient(CW / 2, CH * 0.85, 0, CW / 2, CH * 0.85, CW * 0.6);
        glow.addColorStop(0, 'rgba(191,163,255,.35)'); glow.addColorStop(1, 'rgba(191,163,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, CW, CH);
        const rnd = rng(11);
        for (let i = 0; i < 90; i++) {
          ctx.globalAlpha = 0.4 + rnd() * 0.6;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(rnd() * CW, rnd() * CH, m * (0.002 + rnd() * 0.004), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 6; i++) sparkle(ctx, rnd() * CW, rnd() * py * 0.9 + m * 0.01, m * (0.012 + rnd() * 0.012), '#fff3c4');

        drawPhoto(ctx, L.src, px, py, pw, ph, m * 0.025, m * 0.01);

        sticker(ctx, A.estrela, px - m * 0.005, py + m * 0.005, { h: m * 0.1, rot: -0.25, shadow: 'rgba(255,220,140,.6)' });
        sticker(ctx, A.estrela, px + pw + m * 0.005, py + m * 0.04, { h: m * 0.07, rot: 0.35, shadow: 'rgba(255,220,140,.6)' });
        sticker(ctx, A.estrela, px + m * 0.05, py + ph + m * 0.13, { h: m * 0.06, rot: 0.2, shadow: 'rgba(255,220,140,.6)' });
        sticker(ctx, A.estrela, px + pw - m * 0.05, py + ph + m * 0.16, { h: m * 0.05, rot: -0.2, shadow: 'rgba(255,220,140,.6)' });
        const logoH = Math.min(m * 0.44, (CH - py - ph) * 1.25);
        sticker(ctx, A['logo-reino'], CW / 2, CH - logoH / 2 - m * 0.015, { h: logoH, shadow: 'rgba(0,0,0,.35)' });
      },
    },

    princesa: {
      pad: { top: 0.07, side: 0.06, bottom: 0.22 },
      need: ['laurinha', 'carruagem', 'coroa', 'estrela'],
      draw(ctx, A, L) {
        const { CW, CH, m, px, py, pw, ph } = L;
        const g = ctx.createLinearGradient(0, 0, CW, CH);
        g.addColorStop(0, '#d9efff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#ffd9ec');
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
        // bolinhas suaves
        const rnd = rng(3);
        for (let i = 0; i < 60; i++) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = ['#ffb3d9', '#bfa3ff', '#8fd0ff', '#e8b93c'][i % 4];
          ctx.beginPath(); ctx.arc(rnd() * CW, rnd() * CH, m * (0.004 + rnd() * 0.004), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // moldura dupla dourada
        ctx.save();
        ctx.strokeStyle = '#e8b93c'; ctx.lineWidth = m * 0.008;
        roundRect(ctx, m * 0.018, m * 0.018, CW - m * 0.036, CH - m * 0.036, m * 0.045); ctx.stroke();
        ctx.lineWidth = m * 0.003;
        roundRect(ctx, m * 0.032, m * 0.032, CW - m * 0.064, CH - m * 0.064, m * 0.035); ctx.stroke();
        ctx.restore();

        drawPhoto(ctx, L.src, px, py, pw, ph, m * 0.03, m * 0.012);

        sticker(ctx, A.coroa, px + m * 0.03, py + m * 0.005, { w: m * 0.16, rot: -0.45 });
        sparkle(ctx, px + pw - m * 0.04, py - m * 0.02, m * 0.022, '#e8b93c');
        sparkle(ctx, px + pw - m * 0.1, py - m * 0.035, m * 0.013, '#bfa3ff');

        const bandY = py + ph, bandH = CH - bandY;
        const girlH = m * 0.44;
        const girl = sticker(ctx, A.laurinha, px + pw - m * 0.1, CH - girlH / 2 - m * 0.02, { h: girlH, rot: 0.03 });
        const car = sticker(ctx, A.carruagem, px + m * 0.11, bandY + bandH * 0.5, { h: bandH * 0.72, rot: -0.03 });
        const left = px + m * 0.11 + (car ? car.w / 2 : 0);
        const right = px + pw - m * 0.1 - (girl ? girl.w / 2 : 0);
        const cx = (left + right) / 2, maxW = (right - left) * 0.95;
        fitText(ctx, `1 aninho da ${NOME}`, cx, bandY + bandH * 0.42, maxW, m * 0.06,
          { color: '#f06aaa', stroke: '#fff', strokeW: m * 0.012 });
        if (DATA) fitText(ctx, DATA, cx, bandY + bandH * 0.7, maxW, m * 0.036, { weight: 600, color: '#3fa3e8' });
      },
    },
  };

  /**
   * Gera a foto com moldura.
   * @param {CanvasImageSource} src  foto (ImageBitmap, <img> ou <canvas>)
   * @param {string} id              'none' | 'reino' | 'ceu' | 'princesa'
   * @param {number} maxSide         maior lado da foto dentro da moldura
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function render(src, id, maxSide) {
    const sw = src.width, sh = src.height;
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const pw = Math.round(sw * k), ph = Math.round(sh * k);
    const style = STYLES[id];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!style) {
      canvas.width = pw; canvas.height = ph;
      ctx.drawImage(src, 0, 0, pw, ph);
      return canvas;
    }
    const [A] = await Promise.all([assets(style.need), fonts()]);
    const m = Math.min(pw, ph);
    const p = style.pad;
    const px = Math.round(m * p.side), py = Math.round(m * p.top);
    const CW = pw + px * 2, CH = py + ph + Math.round(m * p.bottom);
    canvas.width = CW; canvas.height = CH;
    ctx.imageSmoothingQuality = 'high';
    style.draw(ctx, A, { CW, CH, m, px, py, pw, ph, src });
    return canvas;
  }

  // pré-carrega as imagens para a prévia abrir rápido
  function preload() { ['coroa', 'estrela', 'castelo', 'unicornio', 'logo-reino', 'laurinha', 'carruagem'].forEach(n => asset(n).catch(() => {})); fonts(); }

  window.Molduras = { list: LIST, render, preload };
})();
