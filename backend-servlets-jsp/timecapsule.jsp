<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.*" %>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><%= request.getAttribute("capsuleTitle") != null ? request.getAttribute("capsuleTitle") : "Digital Time Capsule — JSP & Servlets Edition" %></title>
  <link rel="stylesheet" href="${pageContext.request.contextPath}/style.css" />
</head>
<body>

  <%-- Server-Side Session / User verification if needed --%>
  <%
    String studentName = (String) session.getAttribute("studentName");
    if (studentName == null) {
      studentName = "Class of 2024";
    }
  %>

  <!-- VIEWPORT CONTAINER -->
  <div id="viewport-container">

    <!-- 3D WEBGL CANVAS -->
    <canvas id="book-canvas"></canvas>

    <!-- TOP VIEW PANEL & SCRUBBER -->
    <header class="top-view-panel" id="top-panel">
      <div class="top-bar-header">
        <div class="brand-capsule">
          <span class="brand-icon">⏳</span>
          <div>
            <div class="brand-title">Time Capsule</div>
            <div style="font-size: 0.72rem; color: var(--gold-light); font-family: 'Dancing Script', cursive;">
              JSP &amp; Servlet Powered • Welcome <%= studentName %>
            </div>
          </div>
          <span class="brand-badge"><%= studentName %></span>
        </div>

        <!-- Camera Mode Switcher -->
        <div class="view-mode-switch" role="tablist">
          <button class="mode-btn active" id="btn-view-3d">
            <span>📖</span> 3D Book
          </button>
          <button class="mode-btn" id="btn-view-top">
            <span>🔭</span> Top View Panel
          </button>
        </div>

        <div class="top-bar-actions">
          <button class="action-pill primary" id="btn-open-studio">
            <span>✂️</span> Scrapbook Studio
          </button>
          <button class="action-pill" id="btn-quick-upload">
            <span>📷</span> + Add Memory
          </button>
          <button class="action-pill" id="btn-sound-toggle">
            🔊 Sound: ON
          </button>
        </div>
      </div>

      <div class="scrubber-wrapper">
        <nav class="scrubber-track" id="top-scrubber-track"></nav>
      </div>
    </header>

    <!-- BOTTOM HERO BAR -->
    <footer class="bottom-info-bar">
      <div class="page-title-box">
        <h1 id="header-page-title">Digital Time Capsule</h1>
        <p id="header-page-subtitle">Interactive 3D memory album connected to Java Servlets</p>
      </div>

      <div class="nav-arrows-box">
        <button class="nav-arrow-btn" id="btn-page-prev">‹</button>
        <button class="nav-arrow-btn" id="btn-page-next">›</button>
      </div>
    </footer>

  </div>

  <jsp:include page="includes/modals.jsp" flush="true" />

  <script src="${pageContext.request.contextPath}/libs/three.min.js"></script>
  <script src="${pageContext.request.contextPath}/libs/OrbitControls.js"></script>
  <script src="${pageContext.request.contextPath}/js/storage.js"></script>
  <script>
    // Enable Servlet Backend mode when served via Tomcat
    StorageService.setServletMode(true, '${pageContext.request.contextPath}/api');
  </script>
  <script src="${pageContext.request.contextPath}/js/book3d.js"></script>
  <script src="${pageContext.request.contextPath}/js/editor.js"></script>
  <script src="${pageContext.request.contextPath}/js/app.js"></script>

</body>
</html>
