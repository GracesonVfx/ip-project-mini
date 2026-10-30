/**
 * Time Capsule — 3D SkinnedMesh Book Engine
 * Faithfully mirrors the R3F SkinnedMesh book with realistic bone curling,
 * multi-segment page bend physics, floating motion, and Dual Camera Modes
 * (3D Perspective Book View + Top View Desk Panel).
 */

const Book3DEngine = (() => {
  // Page dimensional constants (matching reference)
  const PAGE_WIDTH = 1.28;
  const PAGE_HEIGHT = 1.71;
  const PAGE_DEPTH = 0.003;
  const PAGE_SEGMENTS = 30;
  const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

  const easingFactor = 0.5;
  const easingFactorFold = 0.3;
  const insideCurveStrength = 0.022; // Gentle natural curve near spine when resting
  const outsideCurveStrength = 0.006; // Subtle edge wave
  const turningCurveStrength = 0.11; // Dynamic paper arch while page is mid-turn

  // Runtime objects
  let container, canvas;
  let scene, camera, renderer, controls;
  let bookGroup, shadowPlane, ambientLight, dirLight, pointLight;
  let pagesData = [];
  let pageMeshes = [];
  let flipAudio = null;

  let currentPage = 0;
  let delayedPage = 0;
  let targetCameraMode = '3d'; // '3d' | 'top'
  let isTransitioningCam = false;

  // Camera presets
  const CAM_PRESETS = {
    '3d': {
      pos: new THREE.Vector3(0, 1.05, 3.6),
      target: new THREE.Vector3(0, 0, 0),
      bookRotX: -Math.PI / 5.5,
      bookRotY: -Math.PI / 2
    },
    'top': {
      pos: new THREE.Vector3(0, 3.3, 0.05),
      target: new THREE.Vector3(0, 0, 0),
      bookRotX: -Math.PI / 2,
      bookRotY: -Math.PI / 2
    }
  };

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredMesh = null;
  let isAnimating = true;

  // Initialize Page Geometry with Skinning Attributes
  function createPageGeometry() {
    const geo = new THREE.BoxGeometry(
      PAGE_WIDTH,
      PAGE_HEIGHT,
      PAGE_DEPTH,
      PAGE_SEGMENTS,
      2
    );
    geo.translate(PAGE_WIDTH / 2, 0, 0);

    const position = geo.attributes.position;
    const vertex = new THREE.Vector3();
    const skinIndexes = [];
    const skinWeights = [];

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      const x = vertex.x;
      const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
      let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

      skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
      skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
    }

    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndexes, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    return geo;
  }

  // Pre-compiled geometry
  const sharedPageGeometry = createPageGeometry();

  // Create SkinnedMesh with Bone Hierarchy
  function createSkinnedPageMesh(frontTexture, backTexture, isCover, isBackCover) {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new THREE.Bone();
      bones.push(bone);
      if (i === 0) {
        bone.position.x = 0;
      } else {
        bone.position.x = SEGMENT_WIDTH;
      }
      if (i > 0) {
        bones[i - 1].add(bone);
      }
    }
    const skeleton = new THREE.Skeleton(bones);

    // Front / Back materials
    const whiteColor = new THREE.Color(0xf5ead8);
    const emissiveColor = new THREE.Color(0xd4a017);

    const matSide = new THREE.MeshStandardMaterial({ color: 0x221a12, roughness: 0.8 });
    const matEdge = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const matTop  = new THREE.MeshStandardMaterial({ color: 0xf5ead8, roughness: 0.6 });
    const matBtm  = new THREE.MeshStandardMaterial({ color: 0xf5ead8, roughness: 0.6 });

    const frontMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: frontTexture,
      roughness: isCover ? 0.45 : 0.70,
      metalness: isCover ? 0.08 : 0.01,
      emissive: emissiveColor,
      emissiveIntensity: 0
    });

    const backMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: backTexture,
      roughness: isBackCover ? 0.45 : 0.70,
      metalness: isBackCover ? 0.08 : 0.01,
      emissive: emissiveColor,
      emissiveIntensity: 0
    });

    const materials = [matSide, matEdge, matTop, matBtm, frontMat, backMat];

    const mesh = new THREE.SkinnedMesh(sharedPageGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);

    return {
      mesh,
      skeleton,
      group: new THREE.Group(),
      turnedAt: 0,
      lastOpened: false,
      highlighted: false
    };
  }

  // Audio helper
  function playFlipSound() {
    try {
      if (!flipAudio) {
        flipAudio = new Audio('audios/page-flip-01a.mp3');
      }
      flipAudio.currentTime = 0;
      flipAudio.volume = 0.6;
      flipAudio.play().catch(() => {});
    } catch (e) {}
  }

  // Linear angle damping
  function dampAngle(current, target, factor, delta) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * (1 - Math.exp(-factor * 20 * delta));
  }

  return {
    async init(canvasElement, rawPagesData, onPageChangeCallback) {
      canvas = canvasElement;
      container = canvas.parentElement;

      // Renderer
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.88;

      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(
        42,
        container.clientWidth / container.clientHeight,
        0.1,
        100
      );
      camera.position.copy(CAM_PRESETS['3d'].pos);
      camera.lookAt(CAM_PRESETS['3d'].target);

      // Controls
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 8;
      controls.minDistance = 1.5;
      controls.maxPolarAngle = Math.PI / 2 + 0.15;
      controls.target.copy(CAM_PRESETS['3d'].target);

      // Lighting — Warm, comfortable library ambiance without harsh blowout
      ambientLight = new THREE.AmbientLight(0xffeedd, 0.65);
      scene.add(ambientLight);

      dirLight = new THREE.DirectionalLight(0xfff3da, 1.25);
      dirLight.position.set(2.5, 6, 3.5);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.bias = -0.0001;
      scene.add(dirLight);

      pointLight = new THREE.PointLight(0xe8893a, 0.6, 12);
      pointLight.position.set(-3, 2, 2.5);
      scene.add(pointLight);

      const rimLight = new THREE.PointLight(0xd4a017, 0.35, 10);
      rimLight.position.set(2, -1, -3);
      scene.add(rimLight);

      // Shadow Floor Plane (Rustic wood tabletop)
      const shadowGeo = new THREE.PlaneGeometry(16, 16);
      const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
      shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1.15;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);

      // Main book container
      bookGroup = new THREE.Group();
      bookGroup.rotation.y = -Math.PI / 2;
      bookGroup.position.set(0, 0, 0);
      scene.add(bookGroup);

      // Setup Pages
      await this.buildPages(rawPagesData);

      // Event handlers
      this.setupInteraction(onPageChangeCallback);

      // Start loop
      this.animate();

      window.addEventListener('resize', () => this.onResize());
    },

    // Build or rebuild book pages with SkinnedMeshes
    async buildPages(rawPages) {
      pagesData = rawPages;
      pageMeshes.forEach(p => {
        bookGroup.remove(p.group);
        p.mesh.geometry.dispose();
      });
      pageMeshes = [];

      const textureLoader = new THREE.TextureLoader();

      const loadTexture = (url) => {
        return new Promise((resolve) => {
          textureLoader.load(
            url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace || 'srgb';
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              resolve(tex);
            },
            undefined,
            () => {
              // Fallback canvas texture
              const cv = document.createElement('canvas');
              cv.width = 512; cv.height = 682;
              const cx = cv.getContext('2d');
              cx.fillStyle = '#f5ead8';
              cx.fillRect(0, 0, 512, 682);
              resolve(new THREE.CanvasTexture(cv));
            }
          );
        });
      };

      // Page structure:
      // Front cover (page 0): Front = book-cover.png, Back = Page 1 (Spread 0 left)
      // Intermediate pages: Front = Spread i right, Back = Spread i+1 left
      // Back cover: Front = Last spread right, Back = back.png
      const pageList = [];

      // Cover Page
      pageList.push({
        frontSrc: 'textures/book-cover.png',
        backSrc: rawPages[0]?.renderedLeft || rawPages[0]?.left?.items[0]?.src || 'textures/DSC00680.jpg',
        isCover: true,
        title: 'Capsule Cover'
      });

      // Spreads
      for (let i = 0; i < rawPages.length; i++) {
        const nextSpread = rawPages[i + 1];
        pageList.push({
          frontSrc: rawPages[i]?.renderedRight || rawPages[i]?.right?.items[0]?.src || 'textures/DSC00933.jpg',
          backSrc: nextSpread ? (nextSpread.renderedLeft || nextSpread.left?.items[0]?.src || 'textures/DSC00966.jpg') : 'textures/back.png',
          isCover: false,
          isBackCover: !nextSpread,
          title: rawPages[i]?.title || `Spread ${i + 1}`
        });
      }

      for (let index = 0; index < pageList.length; index++) {
        const pInfo = pageList[index];
        const frontTex = await loadTexture(pInfo.frontSrc);
        const backTex = await loadTexture(pInfo.backSrc);

        const pageObj = createSkinnedPageMesh(
          frontTex,
          backTex,
          pInfo.isCover,
          pInfo.isBackCover
        );

        pageObj.group.add(pageObj.mesh);
        pageObj.mesh.position.z = -index * PAGE_DEPTH;
        pageObj.index = index;

        bookGroup.add(pageObj.group);
        pageMeshes.push(pageObj);
      }

      this.updatePagePositions(0, false);
    },

    // Update single page texture dynamically when edited in studio
    updatePageTexture(pageMeshIndex, isFront, canvasElement) {
      if (!pageMeshes[pageMeshIndex]) return;
      const mesh = pageMeshes[pageMeshIndex].mesh;
      const matIndex = isFront ? 4 : 5;
      const newTex = new THREE.CanvasTexture(canvasElement);
      newTex.colorSpace = THREE.SRGBColorSpace || 'srgb';
      newTex.needsUpdate = true;
      mesh.material[matIndex].map = newTex;
      mesh.material[matIndex].needsUpdate = true;
    },

    // Set active page with smooth delayed page flipping
    setPage(targetIndex) {
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex > pageMeshes.length) targetIndex = pageMeshes.length;
      if (currentPage === targetIndex) return;

      currentPage = targetIndex;
      playFlipSound();

      // Trigger cascade flipping
      clearTimeout(this._pageFlipTimer);
      const stepFlip = () => {
        if (delayedPage !== currentPage) {
          const diff = Math.abs(currentPage - delayedPage);
          const delay = diff > 2 ? 40 : 130;
          if (currentPage > delayedPage) delayedPage++;
          else if (currentPage < delayedPage) delayedPage--;

          this.updatePagePositions(delayedPage, true);

          if (delayedPage !== currentPage) {
            this._pageFlipTimer = setTimeout(stepFlip, delay);
          }
        }
      };
      stepFlip();
    },

    getPage() {
      return currentPage;
    },

    getTotalPages() {
      return pageMeshes.length;
    },

    // Camera Mode Switcher (3D Perspective ⇄ Top View Desk)
    setCameraMode(mode) {
      targetCameraMode = mode;
      isTransitioningCam = true;
      if (controls) {
        controls.enabled = (mode === '3d');
      }
    },

    getCameraMode() {
      return targetCameraMode;
    },

    updatePagePositions(activePage, animate) {
      const total = pageMeshes.length;
      const bookClosed = activePage === 0 || activePage === total;

      pageMeshes.forEach((pageObj, index) => {
        const opened = activePage > index;
        if (pageObj.lastOpened !== opened) {
          pageObj.turnedAt = performance.now();
          pageObj.lastOpened = opened;
        }

        pageObj.targetOpened = opened;
        pageObj.bookClosed = bookClosed;
        pageObj.mesh.position.z = -index * PAGE_DEPTH + activePage * PAGE_DEPTH;
      });
    },

    setupInteraction(onPageChange) {
      let isDragging = false;
      let startX = 0, startY = 0;

      container.addEventListener('pointerdown', (e) => {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
      });

      container.addEventListener('pointermove', (e) => {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist > 6) isDragging = true;

        // Raycasting for page edge hover
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(
          pageMeshes.map(p => p.mesh),
          true
        );

        if (intersects.length > 0) {
          container.style.cursor = 'pointer';
          const hitObj = pageMeshes.find(p => p.mesh === intersects[0].object);
          if (hitObj) {
            pageMeshes.forEach(p => (p.highlighted = false));
            hitObj.highlighted = true;
          }
        } else {
          container.style.cursor = 'grab';
          pageMeshes.forEach(p => (p.highlighted = false));
        }
      });

      container.addEventListener('pointerup', (e) => {
        if (isDragging) return;

        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(
          pageMeshes.map(p => p.mesh),
          true
        );

        if (intersects.length > 0) {
          const hitObj = pageMeshes.find(p => p.mesh === intersects[0].object);
          if (hitObj) {
            const newPage = hitObj.lastOpened ? hitObj.index : hitObj.index + 1;
            this.setPage(newPage);
            if (onPageChange) onPageChange(newPage);
          }
        }
      });
    },

    animate() {
      let clock = new THREE.Clock();

      const loop = () => {
        requestAnimationFrame(loop);
        const delta = Math.min(clock.getDelta(), 0.1);
        const time = performance.now() * 0.001;

        // Smooth camera transition between 3D and Top View
        const targetPreset = CAM_PRESETS[targetCameraMode];
        if (targetPreset) {
          camera.position.lerp(targetPreset.pos, 0.08);
          controls.target.lerp(targetPreset.target, 0.08);

          if (targetCameraMode === '3d') {
            // Gentle organic floating motion
            bookGroup.position.y = Math.sin(time * 1.5) * 0.035;
            bookGroup.rotation.x = targetPreset.bookRotX + Math.sin(time * 1.2) * 0.02;
          } else {
            // Pure flat top-down desk alignment
            bookGroup.position.y = 0;
            bookGroup.rotation.x = -Math.PI / 2;
            camera.up.set(0, 0, -1);
          }
        }

        controls.update();

        // Smooth horizontal centering: cover centered when closed, spread centered when open
        const total = pageMeshes.length;
        let targetBookX = 0;
        if (currentPage === 0) {
          targetBookX = -PAGE_WIDTH * 0.45;
        } else if (currentPage >= total) {
          targetBookX = PAGE_WIDTH * 0.45;
        } else {
          targetBookX = 0;
        }
        bookGroup.position.x = THREE.MathUtils.lerp(bookGroup.position.x, targetBookX, 0.08);

        // Update each page's bone skeleton curves and wide spread
        pageMeshes.forEach((pageObj) => {
          const { mesh, skeleton, group, turnedAt, targetOpened, bookClosed, index, highlighted } = pageObj;
          const opened = targetOpened;

          // Emissive highlight feedback
          const emissiveTarget = highlighted ? 0.22 : 0;
          mesh.material[4].emissiveIntensity = THREE.MathUtils.lerp(
            mesh.material[4].emissiveIntensity,
            emissiveTarget,
            0.1
          );
          mesh.material[5].emissiveIntensity = THREE.MathUtils.lerp(
            mesh.material[5].emissiveIntensity,
            emissiveTarget,
            0.1
          );

          // Page turning arc time
          const elapsed = performance.now() - turnedAt;
          let turningTime = Math.min(400, Math.max(0, elapsed)) / 400;
          turningTime = Math.sin(turningTime * Math.PI);

          // Wide-opening book angle calculations
          const cradleAngle = targetCameraMode === 'top'
            ? THREE.MathUtils.degToRad(1.2) // Top view lies almost completely flat (177.6 deg)
            : THREE.MathUtils.degToRad(7.0); // 3D view opens wide and inviting (~166 deg)

          let groupTargetRotation = 0;
          if (bookClosed) {
            // Closed on front cover: all pages lie flat on the right
            // Closed on back cover: all pages lie flat on the left
            groupTargetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
          } else {
            // Open book spread: left pages swing wide left (-90 deg), right pages swing wide right (+90 deg)
            // Both stacks lie completely parallel with zero scissors overlap
            groupTargetRotation = opened ? (-Math.PI / 2 + cradleAngle) : (Math.PI / 2 - cradleAngle);
          }

          // Smooth Z positioning with mid-air lift during page turns so flipping pages never clip
          const targetZ = -index * PAGE_DEPTH + delayedPage * PAGE_DEPTH + (turningTime * 0.035);
          mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, targetZ, 0.2);

          // Group hinge rotates to the wide-open position
          group.rotation.y = dampAngle(group.rotation.y, groupTargetRotation, easingFactor, delta);

          // Bone skeleton curves for multi-segment paper bend physics
          let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
          const bones = skeleton.bones;
          bones[0].rotation.set(0, 0, 0);

          for (let i = 1; i < bones.length; i++) {
            const bone = bones[i];

            const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
            const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
            const turningIntensity = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;

            let rotationAngle = 0;
            let foldRotationAngle = 0;

            if (!bookClosed) {
              rotationAngle =
                insideCurveStrength * insideCurveIntensity * targetRotation -
                outsideCurveStrength * outsideCurveIntensity * targetRotation +
                turningCurveStrength * turningIntensity * targetRotation;

              foldRotationAngle = THREE.MathUtils.degToRad(Math.sign(targetRotation) * 2.5);
            }

            // Bone Y angle damping
            bone.rotation.y = dampAngle(bone.rotation.y, rotationAngle, easingFactor, delta);

            // Bone X folding damping
            const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime : 0;
            bone.rotation.x = dampAngle(
              bone.rotation.x,
              foldRotationAngle * foldIntensity,
              easingFactorFold,
              delta
            );
          }
        });

        renderer.render(scene, camera);
      };
      loop();
    },

    onResize() {
      if (!renderer || !camera || !container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  };
})();
