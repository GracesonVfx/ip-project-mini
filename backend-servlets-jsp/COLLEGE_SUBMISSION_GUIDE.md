# 🏺 Digital Time Capsule — College Project & Professor ("Ma'am") Submission Guide

> **Project Title:** Interactive 3D Digital Time Capsule with Creative Scrapbook Studio  
> **Architecture Pattern:** MVC (Model-View-Controller) with Java Servlets, JSP & Three.js WebGL

---

## 1. Project Overview for Your Ma'am

This project addresses a timeless human need: preserving college memories (group photos, event celebrations, canteen candids, farewell tears) in an emotional, interactive, and nostalgic digital capsule.

### Key Highlights:
1. **Interactive 3D SkinnedMesh Book Engine (Three.js WebGL):**
   - Realistic multi-segment bone page curl physics (`SkinnedMesh`, `Skeleton`, `Bones`).
   - Dynamic page bending, leather cover textures, realistic light reflection, and cast shadows.
   - Authentic page-turning audio (`page-flip-01a.mp3`).
2. **Dual View Modes (3D Orbit ⇄ Top View Panel):**
   - **3D Orbit Book View:** 360° rotational camera orbiting the leather-bound album with natural floating motion.
   - **Top View Panel:** Top-down desk view allowing students to view the open dual-page scrapbook spread flat as if sitting at a library study desk, accompanied by an interactive page scrubber bar!
3. **Creative Scrapbook Studio & Custom Photo Borders:**
   - **Borders:** Classic Polaroid with handwriting chin, Zigzag / Postage Stamp serrated edges, Ornate Gold Lines, Washi Tape, and 35mm Film Strip.
   - **Freeform Canvas:** Drag photos anywhere, rotate at any angle, resize, and stack (bring forward / send back).
   - **Nostalgic Elements:** Handwritten sticky notes, college stickers, and photo filters (Sepia, Golden Hour, 90s Film, B&W).
   - **3D Texture Baking:** Generates high-res textures and updates the 3D book in real-time!
4. **Hybrid Storage & Servlet Bridge:**
   - **Local Mode (Instant Demo):** Uses IndexedDB + LocalStorage for 100% offline capability with zero server setup.
   - **Servlet / JSP Mode (Tomcat Submission):** Fully prepared with Java Servlets, JDBC DAO, and JSP templates.

---

## 2. MVC Architecture Mapping

| Component | Technology | Responsibility |
|---|---|---|
| **Model** | `CapsuleDAO.java` / `storage.js` | Database persistence (MySQL/IndexedDB), data layout schemas |
| **Controller** | `MemoryServlet.java` | HTTP GET / POST handler, multipart image file upload processing, JSON REST API |
| **View (Server)** | `timecapsule.jsp` | Server-rendered templates, session user validation |
| **View (Client)** | `book3d.js` & `index.html` | Three.js SkinnedMesh 3D rendering, Top View Desk panel |
| **Interactive Studio**| `editor.js` | Canvas-based photo editing, border stylization, layer stacking |

---

## 3. How to Present to Your Ma'am

1. **Step 1: Open the 3D Book**
   - Double click `index.html` in any web browser.
   - Show how dragging flips the camera, clicking page corners flips pages with smooth curling and sound.
2. **Step 2: Toggle Top View Panel**
   - Click **"🔭 Top View Panel"** in the top bar. Show how the camera smoothly transitions to directly above the desk.
   - Click on the page scrubber pills (`Cover`, `Spread 1`, `Spread 2`, etc.) to jump between spreads.
3. **Step 3: Open Scrapbook Studio**
   - Click **"✂️ Scrapbook Studio"**.
   - Select a photo and demonstrate changing the border from **Polaroid** to **Zigzag / Stamp** to **Gold Line** to **Washi Tape**.
   - Drag the photo around, use the top rotation pin to tilt it, and click "Bring Forward".
   - Click **"✨ Seal & Update 3D Book"** and watch the 3D book instantly update with the newly designed page!
4. **Step 4: Explain the Servlet / JSP Code**
   - Open the `backend-servlets-jsp/` folder and showcase `MemoryServlet.java` (demonstrating `@WebServlet`, `@MultipartConfig`, `doGet`, and `doPost`).
   - Show `CapsuleDAO.java` and explain how prepared statements prevent SQL injection.
   - Show `timecapsule.jsp` and explain how client-side `StorageService.setServletMode(true)` seamlessly shifts storage from LocalStorage to the Servlet API!
