package com.timecapsule.servlet;

import java.io.*;
import java.nio.file.*;
import javax.servlet.*;
import javax.servlet.annotation.*;
import javax.servlet.http.*;

/**
 * MemoryServlet — Java EE Controller for the Digital Time Capsule.
 * Handles API requests for retrieving, creating, and updating memory spreads,
 * as well as handling multipart photo uploads.
 */
@WebServlet(name = "MemoryServlet", urlPatterns = {"/api/pages", "/api/upload"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2, // 2MB
    maxFileSize = 1024 * 1024 * 20,      // 20MB
    maxRequestSize = 1024 * 1024 * 50    // 50MB
)
public class MemoryServlet extends HttpServlet {

    private static final String DATA_FILE = "capsule_data.json";
    private String uploadDirectory;

    @Override
    public void init() throws ServletException {
        // Initialize upload directory within webapp or server folder
        uploadDirectory = getServletContext().getRealPath("/uploads");
        File uploadDir = new File(uploadDirectory);
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }
    }

    /**
     * GET /api/pages — Returns all album spreads as JSON
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        File dataFile = new File(uploadDirectory, DATA_FILE);
        if (dataFile.exists()) {
            String jsonContent = new String(Files.readAllBytes(dataFile.toPath()), "UTF-8");
            response.getWriter().write(jsonContent);
        } else {
            // Return empty or default array
            response.getWriter().write("[]");
        }
    }

    /**
     * POST /api/pages — Saves updated memory spreads layout JSON
     * POST /api/upload — Handles student photo multipart uploads
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");

        String path = request.getServletPath();

        if ("/api/upload".equals(path)) {
            // Handle multipart photo file upload
            Part filePart = request.getPart("photo");
            if (filePart != null) {
                String originalFileName = Paths.get(filePart.getSubmittedFileName()).getFileName().toString();
                String storedFileName = "photo_" + System.currentTimeMillis() + "_" + originalFileName;
                File targetFile = new File(uploadDirectory, storedFileName);

                try (InputStream input = filePart.getInputStream()) {
                    Files.copy(input, targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                }

                response.setContentType("application/json;charset=UTF-8");
                String photoUrl = request.getContextPath() + "/uploads/" + storedFileName;
                response.getWriter().write("{\"success\": true, \"url\": \"" + photoUrl + "\"}");
            } else {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing photo file");
            }
        } else {
            // Handle JSON body save for /api/pages
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = request.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            String jsonPayload = sb.toString();
            File dataFile = new File(uploadDirectory, DATA_FILE);
            Files.write(dataFile.toPath(), jsonPayload.getBytes("UTF-8"));

            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\": \"saved\", \"timestamp\": " + System.currentTimeMillis() + "}");
        }
    }
}
