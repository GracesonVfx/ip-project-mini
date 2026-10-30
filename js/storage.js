/**
 * Time Capsule — Storage & Data Service
 * Supports IndexedDB for high-res images, LocalStorage for metadata,
 * and seamless fallback / bridge to Java Servlets & JSP backends.
 */

const StorageService = (() => {
  const DB_NAME = 'TimeCapsuleDB';
  const DB_VERSION = 1;
  const STORE_IMAGES = 'page_textures';
  const LS_PAGES_KEY = 'tc_pages_v2';
  const LS_CONFIG_KEY = 'tc_config_v2';

  // Toggle this flag when deploying to Tomcat / Servlet environment
  let useServletBackend = false;
  let servletBaseUrl = '/TimeCapsule/api';

  // Open IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Save image data to IndexedDB
  async function saveImage(key, dataUrl) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        store.put(dataUrl, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB save failed, falling back to memory/LS', e);
      return false;
    }
  }

  // Get image data from IndexedDB
  async function getImage(key) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  // Initial starter student memories
  const defaultPages = [
    {
      id: 'page_1_2',
      title: 'Orientation & First Day On Campus',
      subtitle: 'Where it all began — August 2021',
      date: '2021-08-16',
      category: 'classroom',
      left: {
        bg: 'parchment',
        items: [
          {
            id: 'item_1',
            type: 'photo',
            src: 'textures/DSC00680.jpg',
            x: 80, y: 70, w: 260, h: 320,
            rotation: -4,
            borderStyle: 'polaroid',
            borderColor: '#ffffff',
            caption: 'First Day at Quad 🏛️',
            date: 'Day 1 on Campus',
            filter: 'nostalgia',
            zIndex: 1
          },
          {
            id: 'item_2',
            type: 'sticker',
            text: '✨ Unforgettable Start',
            x: 100, y: 440, w: 180, h: 48,
            rotation: 2,
            stickerStyle: 'tape-gold',
            zIndex: 3
          }
        ]
      },
      right: {
        bg: 'parchment',
        items: [
          {
            id: 'item_3',
            type: 'photo',
            src: 'textures/DSC00933.jpg',
            x: 50, y: 90, w: 270, h: 290,
            rotation: 5,
            borderStyle: 'zigzag',
            borderColor: '#f5ead8',
            caption: 'Nervous smiles & roll calls',
            filter: 'warm',
            zIndex: 1
          },
          {
            id: 'item_4',
            type: 'note',
            text: '“We walked in as total strangers... having no clue we’d become family.”',
            x: 60, y: 410, w: 250, h: 100,
            rotation: -2,
            noteColor: '#fff9db',
            zIndex: 2
          }
        ]
      }
    },
    {
      id: 'page_3_4',
      title: 'Canteen Tales & Endless Chai Sessions',
      subtitle: 'The best lectures were attended at the canteen table',
      date: '2022-03-14',
      category: 'candid',
      left: {
        bg: 'grid',
        items: [
          {
            id: 'item_5',
            type: 'photo',
            src: 'textures/DSC00966.jpg',
            x: 60, y: 60, w: 280, h: 330,
            rotation: -3,
            borderStyle: 'line-gold',
            borderColor: '#d4a017',
            caption: 'Maggi + Samosa Debates ☕',
            filter: 'sepia',
            zIndex: 1
          },
          {
            id: 'item_6',
            type: 'sticker',
            text: '❤️ Best Gang Ever',
            x: 70, y: 420, w: 170, h: 45,
            rotation: -5,
            stickerStyle: 'badge-rust',
            zIndex: 2
          }
        ]
      },
      right: {
        bg: 'grid',
        items: [
          {
            id: 'item_7',
            type: 'photo',
            src: 'textures/DSC00983.jpg',
            x: 50, y: 70, w: 280, h: 320,
            rotation: 4,
            borderStyle: 'washi',
            borderColor: '#ffffff',
            caption: 'Bunking 3rd hour for chai 🤫',
            filter: 'film90',
            zIndex: 1
          },
          {
            id: 'item_8',
            type: 'note',
            text: 'Total Chai cups consumed: 2,481 ☕\nAssignments submitted on time: 0 😅',
            x: 70, y: 415, w: 240, h: 90,
            rotation: 1,
            noteColor: '#ffecb3',
            zIndex: 2
          }
        ]
      }
    },
    {
      id: 'page_5_6',
      title: 'Tech Fest & Cultural Nights',
      subtitle: 'Lights, music, sweat & victory moments',
      date: '2023-11-20',
      category: 'event',
      left: {
        bg: 'parchment',
        items: [
          {
            id: 'item_9',
            type: 'photo',
            src: 'textures/DSC01011.jpg',
            x: 50, y: 50, w: 280, h: 330,
            rotation: -6,
            borderStyle: 'film',
            borderColor: '#111111',
            caption: 'Stage Performance Night 🎸',
            filter: 'vivid',
            zIndex: 1
          },
          {
            id: 'item_10',
            type: 'sticker',
            text: '🏆 1st Prize — Hackathon!',
            x: 60, y: 410, w: 220, h: 46,
            rotation: 3,
            stickerStyle: 'tape-gold',
            zIndex: 3
          }
        ]
      },
      right: {
        bg: 'parchment',
        items: [
          {
            id: 'item_11',
            type: 'photo',
            src: 'textures/DSC01040.jpg',
            x: 60, y: 70, w: 270, h: 310,
            rotation: 3,
            borderStyle: 'polaroid',
            borderColor: '#ffffff',
            caption: 'Backstage madness! 🎉',
            filter: 'warm',
            zIndex: 1
          },
          {
            id: 'item_12',
            type: 'note',
            text: '“48 hours with zero sleep and endless Red Bull, but we built something legendary!”',
            x: 60, y: 410, w: 250, h: 95,
            rotation: -3,
            noteColor: '#e0f2fe',
            zIndex: 2
          }
        ]
      }
    },
    {
      id: 'page_7_8',
      title: 'The Farewell & Prom Memories',
      subtitle: 'Holding back tears while signing each other’s shirts',
      date: '2024-05-18',
      category: 'group',
      left: {
        bg: 'parchment',
        items: [
          {
            id: 'item_13',
            type: 'photo',
            src: 'textures/DSC01064.jpg',
            x: 50, y: 60, w: 280, h: 330,
            rotation: -2,
            borderStyle: 'polaroid',
            borderColor: '#ffffff',
            caption: 'Class of 2024 Final Photo 🎓',
            filter: 'nostalgia',
            zIndex: 1
          },
          {
            id: 'item_14',
            type: 'sticker',
            text: '🌸 Forever In Our Hearts',
            x: 80, y: 420, w: 200, h: 46,
            rotation: 1,
            stickerStyle: 'badge-rust',
            zIndex: 3
          }
        ]
      },
      right: {
        bg: 'parchment',
        items: [
          {
            id: 'item_15',
            type: 'photo',
            src: 'textures/DSC01071.jpg',
            x: 60, y: 70, w: 270, h: 320,
            rotation: 4,
            borderStyle: 'line-gold',
            borderColor: '#d4a017',
            caption: 'Promises to never lose touch 🤝',
            filter: 'warm',
            zIndex: 1
          },
          {
            id: 'item_16',
            type: 'note',
            text: '“How lucky I am to have something that makes saying goodbye so hard.” — Winnie the Pooh',
            x: 60, y: 415, w: 250, h: 100,
            rotation: -1,
            noteColor: '#fce7f3',
            zIndex: 2
          }
        ]
      }
    }
  ];

  // Config defaults
  const defaultConfig = {
    title: 'Time Capsule — Class of 2024',
    subtitle: 'Where our youth and memories live forever',
    owner: 'Batch 2020-2024',
    theme: 'nostalgic',
    enableSound: true
  };

  return {
    isServletMode() {
      return useServletBackend;
    },
    setServletMode(enabled, baseUrl = '/TimeCapsule/api') {
      useServletBackend = enabled;
      servletBaseUrl = baseUrl;
    },

    // Get capsule settings
    getConfig() {
      try {
        const val = localStorage.getItem(LS_CONFIG_KEY);
        return val ? { ...defaultConfig, ...JSON.parse(val) } : { ...defaultConfig };
      } catch (e) {
        return { ...defaultConfig };
      }
    },

    saveConfig(cfg) {
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cfg));
    },

    // Get all album page layouts
    async getPages() {
      if (useServletBackend) {
        try {
          const res = await fetch(`${servletBaseUrl}/pages`);
          if (res.ok) return await res.json();
        } catch (e) {
          console.warn('Servlet fetch failed, falling back to local', e);
        }
      }

      try {
        const raw = localStorage.getItem(LS_PAGES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('LS parse failed', e);
      }

      // Default pages
      this.savePages(defaultPages);
      return defaultPages;
    },

    // Save album pages
    async savePages(pages) {
      localStorage.setItem(LS_PAGES_KEY, JSON.stringify(pages));
      if (useServletBackend) {
        try {
          await fetch(`${servletBaseUrl}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pages)
          });
        } catch (e) {
          console.warn('Failed to sync to Servlet', e);
        }
      }
    },

    // Update single page layout
    async updatePage(pageIndex, pageData) {
      const pages = await this.getPages();
      if (pageIndex >= 0 && pageIndex < pages.length) {
        pages[pageIndex] = pageData;
      } else {
        pages.push(pageData);
      }
      await this.savePages(pages);
      return pages;
    },

    // Cache rendered texture dataURL in IndexedDB
    async cacheTexture(key, dataUrl) {
      return await saveImage(key, dataUrl);
    },

    async getCachedTexture(key) {
      return await getImage(key);
    },

    // Reset to demo factory defaults
    resetDefaults() {
      localStorage.removeItem(LS_PAGES_KEY);
      localStorage.removeItem(LS_CONFIG_KEY);
      return defaultPages;
    }
  };
})();
