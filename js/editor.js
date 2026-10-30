/**
 * Time Capsule — Scrapbook Studio & Photo Canvas Editor
 * Allows students to upload photos, move, scale, rotate, stack,
 * add custom borders (zigzag, line, polaroid, washi, film),
 * filters, sticky notes, and stamps, then bake into 3D book pages.
 */

const ScrapbookEditor = (() => {
  let studioModal, canvasEl, ctx;
  let currentSpreadIndex = 0;
  let activeSide = 'left'; // 'left' | 'right'
  let currentSpreadData = null;
  let selectedItemId = null;

  let isDragging = false;
  let isRotating = false;
  let isResizing = false;
  let dragStartX = 0, dragStartY = 0;
  let itemInitialState = null;

  // Canvas coordinate dimensions (matching 3:4 aspect ratio)
  const CANVAS_W = 400;
  const CANVAS_H = 533;

  // Cache loaded Image objects for fast canvas rendering
  const imageCache = new Map();

  function loadImage(src) {
    if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        // Fallback colored placeholder
        const cv = document.createElement('canvas');
        cv.width = 300; cv.height = 300;
        const c = cv.getContext('2d');
        c.fillStyle = '#c4b490';
        c.fillRect(0, 0, 300, 300);
        const fallback = new Image();
        fallback.src = cv.toDataURL();
        resolve(fallback);
      };
      img.src = src;
    });
  }

  // Draw background paper texture
  function drawPaperBackground(ctx, style) {
    // Warm aged parchment gradient
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, '#f8f1e3');
    grad.addColorStop(0.5, '#f4ecd8');
    grad.addColorStop(1, '#ebe0c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle paper edge shadow / inner vignette
    const vig = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.4,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(110, 75, 30, 0.12)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (style === 'grid') {
      ctx.strokeStyle = 'rgba(180, 150, 110, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 20; x < CANVAS_W; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 20; y < CANVAS_H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }
    } else {
      // Classic lined notebook paper
      ctx.strokeStyle = 'rgba(160, 130, 90, 0.1)';
      ctx.lineWidth = 1;
      for (let y = 35; y < CANVAS_H; y += 22) {
        ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(CANVAS_W - 15, y); ctx.stroke();
      }
      // Left margin red line
      ctx.strokeStyle = 'rgba(220, 80, 60, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(35, 0); ctx.lineTo(35, CANVAS_H); ctx.stroke();
    }
  }

  // Draw photo item with chosen border style
  async function drawPhotoItem(ctx, item, isSelected) {
    const img = await loadImage(item.src);
    ctx.save();
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
    ctx.rotate((item.rotation * Math.PI) / 180);

    const halfW = item.w / 2;
    const halfH = item.h / 2;

    // Drop shadow
    ctx.shadowColor = 'rgba(30, 18, 8, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;

    const bStyle = item.borderStyle || 'polaroid';

    if (bStyle === 'polaroid') {
      // Classic Polaroid: Extra chin at bottom for handwriting
      const pad = 10;
      const chin = 38;
      const frameW = item.w;
      const frameH = item.h;

      ctx.fillStyle = item.borderColor || '#ffffff';
      ctx.fillRect(-halfW, -halfH, frameW, frameH);

      // Disable shadow for inner photo
      ctx.shadowColor = 'transparent';

      // Inner photo
      const photoW = frameW - pad * 2;
      const photoH = frameH - pad - chin;
      ctx.drawImage(img, -halfW + pad, -halfH + pad, photoW, photoH);

      // Apply photo filter tint if requested
      applyFilterOverlay(ctx, -halfW + pad, -halfH + pad, photoW, photoH, item.filter);

      // Handwritten caption on chin
      if (item.caption) {
        ctx.fillStyle = '#3a2b1c';
        ctx.font = '600 13px "Dancing Script", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(item.caption, 0, halfH - chin / 2 + 3);
      }
    } else if (bStyle === 'zigzag') {
      // Vintage Postage Stamp / Zigzag scalloped border
      const pad = 12;
      const frameW = item.w;
      const frameH = item.h;

      // Draw serrated stamp path
      ctx.fillStyle = item.borderColor || '#fcf8f0';
      drawZigzagPath(ctx, -halfW, -halfH, frameW, frameH, 8);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      const photoW = frameW - pad * 2;
      const photoH = frameH - pad * 2;
      ctx.drawImage(img, -halfW + pad, -halfH + pad, photoW, photoH);

      applyFilterOverlay(ctx, -halfW + pad, -halfH + pad, photoW, photoH, item.filter);

      // Stamp cancellation postmark overlay
      ctx.strokeStyle = 'rgba(90, 50, 20, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(halfW - 24, halfH - 24, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '8px sans-serif';
      ctx.fillStyle = 'rgba(90, 50, 20, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText('MEMORY', halfW - 24, halfH - 26);
      ctx.fillText('ARCHIVE', halfW - 24, halfH - 16);
    } else if (bStyle === 'line-gold') {
      // Ornate Double Line with Golden filigree corners
      const pad = 10;
      ctx.fillStyle = '#1c1610';
      ctx.fillRect(-halfW, -halfH, item.w, item.h);

      ctx.shadowColor = 'transparent';
      const photoW = item.w - pad * 2;
      const photoH = item.h - pad * 2;
      ctx.drawImage(img, -halfW + pad, -halfH + pad, photoW, photoH);
      applyFilterOverlay(ctx, -halfW + pad, -halfH + pad, photoW, photoH, item.filter);

      // Gold ornate lines
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = 2;
      ctx.strokeRect(-halfW + 4, -halfH + 4, item.w - 8, item.h - 8);

      ctx.strokeStyle = 'rgba(245, 197, 106, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-halfW + 7, -halfH + 7, item.w - 14, item.h - 14);

      // Corner ornaments
      drawCornerFiligree(ctx, -halfW + 4, -halfH + 4);
      drawCornerFiligree(ctx, halfW - 4, -halfH + 4);
      drawCornerFiligree(ctx, -halfW + 4, halfH - 4);
      drawCornerFiligree(ctx, halfW - 4, halfH - 4);
    } else if (bStyle === 'washi') {
      // Washi Tape holding corners
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-halfW, -halfH, item.w, item.h);

      ctx.shadowColor = 'transparent';
      const pad = 6;
      ctx.drawImage(img, -halfW + pad, -halfH + pad, item.w - pad * 2, item.h - pad * 2);
      applyFilterOverlay(ctx, -halfW + pad, -halfH + pad, item.w - pad * 2, item.h - pad * 2, item.filter);

      // Top washi tape strip
      ctx.fillStyle = 'rgba(235, 185, 120, 0.85)';
      ctx.save();
      ctx.rotate(-0.06);
      ctx.fillRect(-halfW + 25, -halfH - 8, item.w - 50, 18);
      // Tape texture lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let tx = -halfW + 30; tx < halfW - 30; tx += 6) {
        ctx.beginPath(); ctx.moveTo(tx, -halfH - 8); ctx.lineTo(tx + 4, -halfH + 10); ctx.stroke();
      }
      ctx.restore();
    } else if (bStyle === 'film') {
      // 35mm Film Strip Frame
      ctx.fillStyle = '#111111';
      ctx.fillRect(-halfW, -halfH, item.w, item.h);

      ctx.shadowColor = 'transparent';
      // Sprocket holes top & bottom
      ctx.fillStyle = '#ffffff';
      for (let sx = -halfW + 8; sx < halfW - 8; sx += 14) {
        ctx.fillRect(sx, -halfH + 4, 8, 6);
        ctx.fillRect(sx, halfH - 10, 8, 6);
      }

      const photoW = item.w - 12;
      const photoH = item.h - 32;
      ctx.drawImage(img, -halfW + 6, -halfH + 16, photoW, photoH);
      applyFilterOverlay(ctx, -halfW + 6, -halfH + 16, photoW, photoH, item.filter);

      ctx.fillStyle = 'rgba(255, 180, 50, 0.7)';
      ctx.font = '8px monospace';
      ctx.fillText('KODAK 400', -halfW + 8, halfH - 14);
    } else {
      // Plain
      ctx.drawImage(img, -halfW, -halfH, item.w, item.h);
      ctx.shadowColor = 'transparent';
      applyFilterOverlay(ctx, -halfW, -halfH, item.w, item.h, item.filter);
    }

    // Selection border & transform handles
    if (isSelected) {
      drawTransformBox(ctx, -halfW, -halfH, item.w, item.h);
    }

    ctx.restore();
  }

  // Draw Sticky Note / Memo
  function drawNoteItem(ctx, item, isSelected) {
    ctx.save();
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
    ctx.rotate((item.rotation * Math.PI) / 180);

    const halfW = item.w / 2;
    const halfH = item.h / 2;

    ctx.shadowColor = 'rgba(40, 25, 10, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = item.noteColor || '#fff9db';
    ctx.fillRect(-halfW, -halfH, item.w, item.h);

    // Subtle curled edge bottom right
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.moveTo(halfW - 14, halfH);
    ctx.lineTo(halfW, halfH - 14);
    ctx.lineTo(halfW, halfH);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Handwritten text with auto line wrap
    ctx.fillStyle = '#2d241e';
    ctx.font = '500 13px "Dancing Script", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const words = (item.text || '').split(' ');
    let line = '';
    let curY = -halfH + 12;
    const maxLineW = item.w - 18;

    for (let w of words) {
      if (w === '\n') {
        ctx.fillText(line, -halfW + 10, curY);
        line = '';
        curY += 16;
        continue;
      }
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > maxLineW) {
        ctx.fillText(line, -halfW + 10, curY);
        line = w;
        curY += 16;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, -halfW + 10, curY);

    if (isSelected) drawTransformBox(ctx, -halfW, -halfH, item.w, item.h);
    ctx.restore();
  }

  // Draw Sticker / Tape Item
  function drawStickerItem(ctx, item, isSelected) {
    ctx.save();
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
    ctx.rotate((item.rotation * Math.PI) / 180);

    const halfW = item.w / 2;
    const halfH = item.h / 2;

    ctx.shadowColor = 'rgba(30, 15, 5, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 3;

    if (item.stickerStyle === 'tape-gold') {
      const grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
      grad.addColorStop(0, '#f5c56a');
      grad.addColorStop(1, '#d4a017');
      ctx.fillStyle = grad;
      ctx.fillRect(-halfW, -halfH, item.w, item.h);

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#221a0f';
      ctx.font = 'bold 12px "Lato", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text || 'MEMORIES', 0, 0);
    } else {
      ctx.fillStyle = '#8b2612';
      ctx.fillRect(-halfW, -halfH, item.w, item.h);

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fce7f3';
      ctx.font = 'bold 12px "Dancing Script", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text || '✨ Forever', 0, 0);
    }

    if (isSelected) drawTransformBox(ctx, -halfW, -halfH, item.w, item.h);
    ctx.restore();
  }

  // Path helper: Serrated stamp zigzag edges
  function drawZigzagPath(ctx, x, y, w, h, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Top
    for (let curX = x; curX < x + w; curX += size * 2) {
      ctx.lineTo(curX + size, y - size * 0.4);
      ctx.lineTo(Math.min(curX + size * 2, x + w), y);
    }
    // Right
    for (let curY = y; curY < y + h; curY += size * 2) {
      ctx.lineTo(x + w + size * 0.4, curY + size);
      ctx.lineTo(x + w, Math.min(curY + size * 2, y + h));
    }
    // Bottom
    for (let curX = x + w; curX > x; curX -= size * 2) {
      ctx.lineTo(curX - size, y + h + size * 0.4);
      ctx.lineTo(Math.max(curX - size * 2, x), y + h);
    }
    // Left
    for (let curY = y + h; curY > y; curY -= size * 2) {
      ctx.lineTo(x - size * 0.4, curY - size);
      ctx.lineTo(x, Math.max(curY - size * 2, y));
    }
    ctx.closePath();
  }

  function drawCornerFiligree(ctx, x, y) {
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Photo filter overlay tint
  function applyFilterOverlay(ctx, x, y, w, h, filterName) {
    if (!filterName || filterName === 'none') return;
    ctx.save();
    if (filterName === 'nostalgia' || filterName === 'sepia') {
      ctx.fillStyle = 'rgba(180, 130, 70, 0.22)';
      ctx.globalCompositeOperation = 'color';
      ctx.fillRect(x, y, w, h);
    } else if (filterName === 'warm') {
      ctx.fillStyle = 'rgba(255, 170, 50, 0.18)';
      ctx.globalCompositeOperation = 'color-burn';
      ctx.fillRect(x, y, w, h);
    } else if (filterName === 'film90') {
      ctx.fillStyle = 'rgba(100, 160, 200, 0.12)';
      ctx.globalCompositeOperation = 'screen';
      ctx.fillRect(x, y, w, h);
    } else if (filterName === 'bw') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.globalCompositeOperation = 'color';
      ctx.fillRect(x, y, w, h);
    } else if (filterName === 'vivid') {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.1)';
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // Interactive transform handles bounding box
  function drawTransformBox(ctx, x, y, w, h) {
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    ctx.setLineDash([]);

    // Corner resize handle (bottom-right)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + w + 4, y + h + 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Top rotation pin
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 4);
    ctx.lineTo(x + w / 2, y - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + w / 2, y - 20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  return {
    init(modalElement) {
      studioModal = modalElement;
      canvasEl = studioModal.querySelector('#studio-canvas');
      ctx = canvasEl.getContext('2d');
      canvasEl.width = CANVAS_W;
      canvasEl.height = CANVAS_H;

      this.bindEvents();
    },

    // Open studio for a given spread and side
    open(spreadData, spreadIndex, side = 'left') {
      currentSpreadData = JSON.parse(JSON.stringify(spreadData));
      currentSpreadIndex = spreadIndex;
      activeSide = side;
      selectedItemId = currentSpreadData[activeSide]?.items[0]?.id || null;

      this.updateUI();
      this.render();
      studioModal.classList.remove('hidden');
    },

    close() {
      studioModal.classList.add('hidden');
    },

    // Render high-res snapshot of a side to an offscreen canvas
    async renderToCanvas(pageSideData, targetWidth = 1024) {
      const targetHeight = Math.round((targetWidth * 4) / 3);
      const offscreen = document.createElement('canvas');
      offscreen.width = targetWidth;
      offscreen.height = targetHeight;
      const offCtx = offscreen.getContext('2d');

      const scale = targetWidth / CANVAS_W;
      offCtx.scale(scale, scale);

      drawPaperBackground(offCtx, pageSideData.bg);

      const items = [...(pageSideData.items || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      for (let item of items) {
        if (item.type === 'photo') {
          await drawPhotoItem(offCtx, item, false);
        } else if (item.type === 'note') {
          drawNoteItem(offCtx, item, false);
        } else if (item.type === 'sticker') {
          drawStickerItem(offCtx, item, false);
        }
      }

      return offscreen;
    },

    // Main studio canvas render
    async render() {
      if (!currentSpreadData) return;
      const sideData = currentSpreadData[activeSide];
      if (!sideData) return;

      drawPaperBackground(ctx, sideData.bg);

      const items = [...(sideData.items || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      for (let item of items) {
        const isSelected = item.id === selectedItemId;
        if (item.type === 'photo') {
          await drawPhotoItem(ctx, item, isSelected);
        } else if (item.type === 'note') {
          drawNoteItem(ctx, item, isSelected);
        } else if (item.type === 'sticker') {
          drawStickerItem(ctx, item, isSelected);
        }
      }
    },

    updateUI() {
      // Toggle side buttons
      const leftBtn = studioModal.querySelector('#side-left-btn');
      const rightBtn = studioModal.querySelector('#side-right-btn');
      if (leftBtn && rightBtn) {
        leftBtn.classList.toggle('active', activeSide === 'left');
        rightBtn.classList.toggle('active', activeSide === 'right');
      }

      // Title
      const titleEl = studioModal.querySelector('#studio-spread-title');
      if (titleEl) {
        titleEl.textContent = `${currentSpreadData.title} (${activeSide.toUpperCase()} PAGE)`;
      }

      // Update control panel based on selected item
      const item = this.getSelectedItem();
      const photoControls = studioModal.querySelector('#studio-photo-controls');
      const noteControls = studioModal.querySelector('#studio-note-controls');

      if (item && item.type === 'photo') {
        if (photoControls) photoControls.style.display = 'block';
        if (noteControls) noteControls.style.display = 'none';

        // Set active border button
        studioModal.querySelectorAll('.border-style-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.border === (item.borderStyle || 'polaroid'));
        });
        // Set filter select
        const fSelect = studioModal.querySelector('#photo-filter-select');
        if (fSelect) fSelect.value = item.filter || 'none';
        // Set caption input
        const capInput = studioModal.querySelector('#photo-caption-input');
        if (capInput) capInput.value = item.caption || '';
      } else if (item && item.type === 'note') {
        if (photoControls) photoControls.style.display = 'none';
        if (noteControls) noteControls.style.display = 'block';
        const noteText = studioModal.querySelector('#note-text-input');
        if (noteText) noteText.value = item.text || '';
      } else {
        if (photoControls) photoControls.style.display = 'none';
        if (noteControls) noteControls.style.display = 'none';
      }
    },

    getSelectedItem() {
      if (!currentSpreadData || !selectedItemId) return null;
      return currentSpreadData[activeSide]?.items.find(i => i.id === selectedItemId);
    },

    // Add new photo from dataURL
    addPhoto(src, caption = 'New Memory') {
      const items = currentSpreadData[activeSide].items;
      const id = 'photo_' + Date.now();
      const maxZ = items.reduce((max, i) => Math.max(max, i.zIndex || 0), 0);

      items.push({
        id,
        type: 'photo',
        src,
        x: 60 + Math.random() * 40,
        y: 60 + Math.random() * 40,
        w: 260,
        h: 300,
        rotation: (Math.random() - 0.5) * 8,
        borderStyle: 'polaroid',
        borderColor: '#ffffff',
        caption,
        filter: 'nostalgia',
        zIndex: maxZ + 1
      });

      selectedItemId = id;
      this.updateUI();
      this.render();
    },

    // Add new sticky note
    addNote(text = 'A moment to cherish forever ✨', color = '#fff9db') {
      const items = currentSpreadData[activeSide].items;
      const id = 'note_' + Date.now();
      const maxZ = items.reduce((max, i) => Math.max(max, i.zIndex || 0), 0);

      items.push({
        id,
        type: 'note',
        text,
        x: 80,
        y: 200,
        w: 220,
        h: 90,
        rotation: (Math.random() - 0.5) * 6,
        noteColor: color,
        zIndex: maxZ + 1
      });

      selectedItemId = id;
      this.updateUI();
      this.render();
    },

    // Add sticker
    addSticker(text = '❤️ BFFs', style = 'tape-gold') {
      const items = currentSpreadData[activeSide].items;
      const id = 'sticker_' + Date.now();
      const maxZ = items.reduce((max, i) => Math.max(max, i.zIndex || 0), 0);

      items.push({
        id,
        type: 'sticker',
        text,
        x: 100,
        y: 350,
        w: 160,
        h: 44,
        rotation: (Math.random() - 0.5) * 10,
        stickerStyle: style,
        zIndex: maxZ + 1
      });

      selectedItemId = id;
      this.updateUI();
      this.render();
    },

    // Stacking
    bringForward() {
      const item = this.getSelectedItem();
      if (!item) return;
      item.zIndex = (item.zIndex || 0) + 1;
      this.render();
    },

    sendBackward() {
      const item = this.getSelectedItem();
      if (!item) return;
      item.zIndex = Math.max(0, (item.zIndex || 0) - 1);
      this.render();
    },

    deleteSelected() {
      if (!selectedItemId) return;
      currentSpreadData[activeSide].items = currentSpreadData[activeSide].items.filter(
        i => i.id !== selectedItemId
      );
      selectedItemId = null;
      this.updateUI();
      this.render();
    },

    bindEvents() {
      // Side toggles
      studioModal.querySelector('#side-left-btn').addEventListener('click', () => {
        activeSide = 'left';
        selectedItemId = currentSpreadData.left?.items[0]?.id || null;
        this.updateUI();
        this.render();
      });
      studioModal.querySelector('#side-right-btn').addEventListener('click', () => {
        activeSide = 'right';
        selectedItemId = currentSpreadData.right?.items[0]?.id || null;
        this.updateUI();
        this.render();
      });

      // Border style selection
      studioModal.querySelectorAll('.border-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = this.getSelectedItem();
          if (item && item.type === 'photo') {
            item.borderStyle = btn.dataset.border;
            this.updateUI();
            this.render();
          }
        });
      });

      // Photo filter selection
      const fSelect = studioModal.querySelector('#photo-filter-select');
      if (fSelect) {
        fSelect.addEventListener('change', (e) => {
          const item = this.getSelectedItem();
          if (item && item.type === 'photo') {
            item.filter = e.target.value;
            this.render();
          }
        });
      }

      // Caption change
      const capInput = studioModal.querySelector('#photo-caption-input');
      if (capInput) {
        capInput.addEventListener('input', (e) => {
          const item = this.getSelectedItem();
          if (item && item.type === 'photo') {
            item.caption = e.target.value;
            this.render();
          }
        });
      }

      // Note text change
      const noteInput = studioModal.querySelector('#note-text-input');
      if (noteInput) {
        noteInput.addEventListener('input', (e) => {
          const item = this.getSelectedItem();
          if (item && item.type === 'note') {
            item.text = e.target.value;
            this.render();
          }
        });
      }

      // Stacking buttons
      studioModal.querySelector('#btn-bring-front')?.addEventListener('click', () => this.bringForward());
      studioModal.querySelector('#btn-send-back')?.addEventListener('click', () => this.sendBackward());
      studioModal.querySelector('#btn-delete-item')?.addEventListener('click', () => this.deleteSelected());

      // Quick sticker buttons
      studioModal.querySelectorAll('.quick-sticker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.addSticker(btn.dataset.text, btn.dataset.style || 'tape-gold');
        });
      });

      // Quick note button
      studioModal.querySelector('#btn-add-note')?.addEventListener('click', () => {
        this.addNote();
      });

      // Photo file upload
      const fileInput = studioModal.querySelector('#studio-file-input');
      studioModal.querySelector('#btn-add-photo')?.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.addPhoto(ev.target.result, file.name.replace(/\.[^.]+$/, ''));
          };
          reader.readAsDataURL(file);
        }
      });

      // Canvas pointer interactions (Drag, Rotate, Scale)
      canvasEl.addEventListener('pointerdown', (e) => {
        const rect = canvasEl.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
        const clickY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

        // Check if clicked on current item's rotation or resize handle
        const sel = this.getSelectedItem();
        if (sel) {
          const cx = sel.x + sel.w / 2;
          const cy = sel.y + sel.h / 2;
          const rad = (sel.rotation * Math.PI) / 180;

          // Local click coords relative to item center
          const dx = clickX - cx;
          const dy = clickY - cy;
          const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
          const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);

          // Check rotate pin (top center)
          if (Math.hypot(localX - 0, localY - (-sel.h / 2 - 20)) < 15) {
            isRotating = true;
            dragStartX = clickX;
            dragStartY = clickY;
            itemInitialState = { ...sel };
            return;
          }

          // Check corner resize pin (bottom-right)
          if (Math.hypot(localX - (sel.w / 2 + 4), localY - (sel.h / 2 + 4)) < 15) {
            isResizing = true;
            dragStartX = clickX;
            dragStartY = clickY;
            itemInitialState = { ...sel };
            return;
          }
        }

        // Hit test items from top zIndex to bottom
        const items = [...(currentSpreadData[activeSide].items || [])].sort(
          (a, b) => (b.zIndex || 0) - (a.zIndex || 0)
        );

        let hit = null;
        for (let item of items) {
          const cx = item.x + item.w / 2;
          const cy = item.y + item.h / 2;
          const rad = (item.rotation * Math.PI) / 180;
          const dx = clickX - cx;
          const dy = clickY - cy;
          const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
          const ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);

          if (Math.abs(lx) <= item.w / 2 && Math.abs(ly) <= item.h / 2) {
            hit = item;
            break;
          }
        }

        if (hit) {
          selectedItemId = hit.id;
          isDragging = true;
          dragStartX = clickX;
          dragStartY = clickY;
          itemInitialState = { ...hit };
        } else {
          selectedItemId = null;
        }

        this.updateUI();
        this.render();
      });

      window.addEventListener('pointermove', (e) => {
        if (!isDragging && !isRotating && !isResizing) return;
        const rect = canvasEl.getBoundingClientRect();
        const curX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
        const curY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

        const sel = this.getSelectedItem();
        if (!sel || !itemInitialState) return;

        if (isDragging) {
          sel.x = Math.round(itemInitialState.x + (curX - dragStartX));
          sel.y = Math.round(itemInitialState.y + (curY - dragStartY));
          this.render();
        } else if (isRotating) {
          const cx = sel.x + sel.w / 2;
          const cy = sel.y + sel.h / 2;
          const angle = Math.atan2(curY - cy, curX - cx);
          sel.rotation = Math.round((angle * 180) / Math.PI + 90);
          this.render();
        } else if (isResizing) {
          const delta = (curX - dragStartX + (curY - dragStartY)) / 2;
          const newW = Math.max(80, Math.min(380, itemInitialState.w + delta));
          const aspect = itemInitialState.h / itemInitialState.w;
          sel.w = Math.round(newW);
          sel.h = Math.round(newW * aspect);
          this.render();
        }
      });

      window.addEventListener('pointerup', () => {
        isDragging = false;
        isRotating = false;
        isResizing = false;
      });

      // Close modal
      studioModal.querySelector('#studio-close-btn')?.addEventListener('click', () => {
        this.close();
      });
    },

    // Save baked texture and sync to 3D book
    async bakeAndSeal(onSuccess) {
      if (!currentSpreadData) return;
      const leftCanvas = await this.renderToCanvas(currentSpreadData.left, 1024);
      const rightCanvas = await this.renderToCanvas(currentSpreadData.right, 1024);

      currentSpreadData.renderedLeft = leftCanvas.toDataURL('image/jpeg', 0.88);
      currentSpreadData.renderedRight = rightCanvas.toDataURL('image/jpeg', 0.88);

      // Save to storage
      await StorageService.updatePage(currentSpreadIndex, currentSpreadData);

      // Update 3D book textures:
      // In book3d, spread index corresponds to:
      // Page Mesh (index + 1) front = spread right, Page Mesh (index) back = spread left
      const meshIndex = currentSpreadIndex + 1;
      Book3DEngine.updatePageTexture(meshIndex, true, rightCanvas);
      Book3DEngine.updatePageTexture(meshIndex - 1, false, leftCanvas);

      if (onSuccess) onSuccess(currentSpreadData);
      this.close();
    }
  };
})();
