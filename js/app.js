/**
 * Time Capsule — Main Application Controller
 * Coordinates 3D SkinnedMesh Book, Top View Desk Mode, Scrapbook Studio,
 * Storage Service, and Interactive UI Panel.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const canvasEl = document.getElementById('book-canvas');
  const studioModalEl = document.getElementById('studio-modal');
  const uploadModalEl = document.getElementById('upload-modal');
  const toastEl = document.getElementById('toast');

  let spreads = [];
  let currentSpreadIdx = 0;
  let soundEnabled = true;

  // Initialize Storage
  const config = StorageService.getConfig();
  spreads = await StorageService.getPages();

  // Initialize Studio Editor
  ScrapbookEditor.init(studioModalEl);

  // Initialize 3D Book Engine
  await Book3DEngine.init(canvasEl, spreads, (activePageIndex) => {
    onPageFlipped(activePageIndex);
  });

  // Render Top Scrubber Bar
  renderTopScrubber();
  updateHeaderInfo(0);

  // Audio helper
  function playClickSound() {
    if (!soundEnabled) return;
    try {
      const a = new Audio('audios/page-flip-01a.mp3');
      a.volume = 0.4;
      a.play().catch(() => {});
    } catch (e) {}
  }

  function showToast(msg, icon = '✨') {
    if (!toastEl) return;
    toastEl.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    toastEl.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3500);
  }

  // Update header text when page flips
  function onPageFlipped(pageIndex) {
    updateTopScrubberActive(pageIndex);
    updateHeaderInfo(pageIndex);
  }

  function updateHeaderInfo(pageIndex) {
    const titleEl = document.getElementById('header-page-title');
    const subtitleEl = document.getElementById('header-page-subtitle');
    const totalMeshes = Book3DEngine.getTotalPages();

    if (pageIndex === 0) {
      currentSpreadIdx = 0;
      if (titleEl) titleEl.textContent = config.title || 'Digital Time Capsule';
      if (subtitleEl) subtitleEl.textContent = 'Click the book cover or use the panel above to open';
    } else if (pageIndex >= totalMeshes) {
      currentSpreadIdx = spreads.length - 1;
      if (titleEl) titleEl.textContent = 'Capsule Sealed — Forever Remembered';
      if (subtitleEl) subtitleEl.textContent = '“The best thing about memories is making them.”';
    } else {
      currentSpreadIdx = Math.max(0, Math.min(spreads.length - 1, pageIndex - 1));
      const sp = spreads[currentSpreadIdx];
      if (titleEl) titleEl.textContent = sp?.title || `Memory Spread #${pageIndex}`;
      if (subtitleEl) subtitleEl.textContent = sp?.subtitle || `${sp?.date || ''} • Click to turn pages or edit below`;
    }
  }

  // Render top scrubber panel with thumbnails
  function renderTopScrubber() {
    const container = document.getElementById('top-scrubber-track');
    if (!container) return;
    container.innerHTML = '';

    // Cover button
    const coverBtn = document.createElement('button');
    coverBtn.className = 'scrubber-pill active';
    coverBtn.dataset.page = '0';
    coverBtn.innerHTML = `<span>📙</span> Cover`;
    coverBtn.addEventListener('click', () => {
      Book3DEngine.setPage(0);
      onPageFlipped(0);
    });
    container.appendChild(coverBtn);

    // Spreads
    spreads.forEach((spread, i) => {
      const pill = document.createElement('button');
      pill.className = 'scrubber-pill';
      pill.dataset.page = (i + 1).toString();
      const icon = spread.category === 'candid' ? '😄' : spread.category === 'event' ? '🎉' : spread.category === 'group' ? '👥' : '🏫';
      pill.innerHTML = `<span>${icon}</span> Spread ${i + 1}: ${spread.title.split(' ')[0]}`;
      pill.addEventListener('click', () => {
        Book3DEngine.setPage(i + 1);
        onPageFlipped(i + 1);
      });
      container.appendChild(pill);
    });

    // Back cover
    const backBtn = document.createElement('button');
    backBtn.className = 'scrubber-pill';
    const lastIdx = spreads.length + 1;
    backBtn.dataset.page = lastIdx.toString();
    backBtn.innerHTML = `<span>🏺</span> Back Cover`;
    backBtn.addEventListener('click', () => {
      Book3DEngine.setPage(lastIdx);
      onPageFlipped(lastIdx);
    });
    container.appendChild(backBtn);
  }

  function updateTopScrubberActive(activePage) {
    document.querySelectorAll('.scrubber-pill').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.page) === activePage);
    });
  }

  // Camera Mode Toggle (3D Orbit ⇄ Top View Desk)
  const btnView3D = document.getElementById('btn-view-3d');
  const btnViewTop = document.getElementById('btn-view-top');

  btnView3D?.addEventListener('click', () => {
    btnView3D.classList.add('active');
    btnViewTop.classList.remove('active');
    Book3DEngine.setCameraMode('3d');
    showToast('Switched to 3D Orbit Book View — drag to rotate in 360°', '📖');
  });

  btnViewTop?.addEventListener('click', () => {
    btnViewTop.classList.add('active');
    btnView3D.classList.remove('active');
    Book3DEngine.setCameraMode('top');
    showToast('Switched to Top-Down Desk Spread View', '🔭');
  });

  // Sound toggle
  const soundBtn = document.getElementById('btn-sound-toggle');
  soundBtn?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.innerHTML = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    showToast(soundEnabled ? 'Page flip audio enabled' : 'Audio muted', '🎵');
  });

  // Open Studio Editor for current spread
  const btnEditSpread = document.getElementById('btn-open-studio');
  btnEditSpread?.addEventListener('click', () => {
    if (spreads.length === 0) return;
    const current = spreads[currentSpreadIdx] || spreads[0];
    ScrapbookEditor.open(current, currentSpreadIdx, 'left');
    showToast('Opened Scrapbook Studio — drag, rotate, stack & style photos!', '✂️');
  });

  // Save / Bake button inside Scrapbook Studio
  const btnBakeSeal = document.getElementById('btn-seal-page');
  btnBakeSeal?.addEventListener('click', () => {
    btnBakeSeal.disabled = true;
    btnBakeSeal.textContent = '⏳ Baking 3D Textures...';
    ScrapbookEditor.bakeAndSeal((updatedData) => {
      spreads[currentSpreadIdx] = updatedData;
      btnBakeSeal.disabled = false;
      btnBakeSeal.textContent = '✨ Seal & Update 3D Book';
      showToast('Page updated! Sealed directly into your 3D Time Capsule!', '🏺');
      playClickSound();
    });
  });

  // Next / Prev buttons in UI
  document.getElementById('btn-page-prev')?.addEventListener('click', () => {
    const cur = Book3DEngine.getPage();
    if (cur > 0) {
      Book3DEngine.setPage(cur - 1);
      onPageFlipped(cur - 1);
    }
  });

  document.getElementById('btn-page-next')?.addEventListener('click', () => {
    const cur = Book3DEngine.getPage();
    const total = Book3DEngine.getTotalPages();
    if (cur < total) {
      Book3DEngine.setPage(cur + 1);
      onPageFlipped(cur + 1);
    }
  });

  // Quick Upload Modal
  const btnQuickUpload = document.getElementById('btn-quick-upload');
  btnQuickUpload?.addEventListener('click', () => {
    uploadModalEl.classList.remove('hidden');
  });

  document.getElementById('upload-close-btn')?.addEventListener('click', () => {
    uploadModalEl.classList.add('hidden');
  });

  // Handle Quick Upload Form
  const quickDropzone = document.getElementById('quick-dropzone');
  const quickFileInput = document.getElementById('quick-file-input');
  let pendingUploadDataUrl = null;

  quickDropzone?.addEventListener('click', () => quickFileInput.click());
  quickFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingUploadDataUrl = ev.target.result;
        quickDropzone.innerHTML = `<img src="${pendingUploadDataUrl}" style="max-height:160px;border-radius:6px;object-fit:cover;" /><p style="margin-top:6px;font-size:0.8rem;color:#f5c56a;">Ready to place in capsule!</p>`;
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('btn-submit-memory')?.addEventListener('click', () => {
    if (!pendingUploadDataUrl) {
      showToast('Please select or drop a photo first!', '⚠️');
      return;
    }
    const title = document.getElementById('memory-title-input').value.trim() || 'Cherished Memory';
    const border = document.querySelector('input[name="border-choice"]:checked')?.value || 'polaroid';
    const targetSpread = parseInt(document.getElementById('target-spread-select').value) || 0;
    const targetSide = document.getElementById('target-side-select').value || 'right';

    // Add to target spread
    if (spreads[targetSpread]) {
      const targetList = spreads[targetSpread][targetSide].items;
      targetList.push({
        id: 'user_photo_' + Date.now(),
        type: 'photo',
        src: pendingUploadDataUrl,
        x: 60 + Math.random() * 30,
        y: 80 + Math.random() * 30,
        w: 260,
        h: 300,
        rotation: (Math.random() - 0.5) * 8,
        borderStyle: border,
        borderColor: '#ffffff',
        caption: title,
        filter: 'nostalgia',
        zIndex: targetList.length + 1
      });

      // Bake that spread immediately
      ScrapbookEditor.open(spreads[targetSpread], targetSpread, targetSide);
      ScrapbookEditor.bakeAndSeal(() => {
        uploadModalEl.classList.add('hidden');
        showToast(`Photo added with ${border} border to Spread #${targetSpread + 1}!`, '📷');
        Book3DEngine.setPage(targetSpread + 1);
        onPageFlipped(targetSpread + 1);
      });
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      const cur = Book3DEngine.getPage();
      const total = Book3DEngine.getTotalPages();
      if (cur < total) {
        Book3DEngine.setPage(cur + 1);
        onPageFlipped(cur + 1);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      const cur = Book3DEngine.getPage();
      if (cur > 0) {
        Book3DEngine.setPage(cur - 1);
        onPageFlipped(cur - 1);
      }
    } else if (e.key === 't' || e.key === 'T') {
      const curMode = Book3DEngine.getCameraMode();
      const nextMode = curMode === '3d' ? 'top' : '3d';
      if (nextMode === '3d') btnView3D?.click();
      else btnViewTop?.click();
    } else if (e.key === 'e' || e.key === 'E') {
      btnEditSpread?.click();
    }
  });
});
