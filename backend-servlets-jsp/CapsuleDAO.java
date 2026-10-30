package com.timecapsule.servlet;

import java.sql.*;
import java.util.*;

/**
 * CapsuleDAO — JDBC Data Access Object for persisting student time capsule
 * memories into MySQL / Oracle / PostgreSQL databases for college projects.
 */
public class CapsuleDAO {

    private String jdbcURL = "jdbc:mysql://localhost:3306/timecapsule_db?useSSL=false";
    private String jdbcUsername = "root";
    private String jdbcPassword = "password";

    private static final String INSERT_MEMORY_SQL = 
        "INSERT INTO memories (id, title, subtitle, event_date, category, json_layout, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW());";
    private static final String SELECT_ALL_MEMORIES_SQL = 
        "SELECT * FROM memories ORDER BY created_at ASC;";
    private static final String DELETE_MEMORY_SQL = 
        "DELETE FROM memories WHERE id = ?;";

    protected Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
        return DriverManager.getConnection(jdbcURL, jdbcUsername, jdbcPassword);
    }

    public void saveMemory(String id, String title, String subtitle, String date, String category, String jsonLayout) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(INSERT_MEMORY_SQL)) {
            ps.setString(1, id);
            ps.setString(2, title);
            ps.setString(3, subtitle);
            ps.setString(4, date);
            ps.setString(5, category);
            ps.setString(6, jsonLayout);
            ps.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public List<Map<String, String>> getAllMemories() {
        List<Map<String, String>> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(SELECT_ALL_MEMORIES_SQL);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, String> row = new HashMap<>();
                row.put("id", rs.getString("id"));
                row.put("title", rs.getString("title"));
                row.put("subtitle", rs.getString("subtitle"));
                row.put("date", rs.getString("event_date"));
                row.put("category", rs.getString("category"));
                row.put("jsonLayout", rs.getString("json_layout"));
                list.add(row);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean deleteMemory(String id) {
        boolean rowDeleted = false;
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(DELETE_MEMORY_SQL)) {
            ps.setString(1, id);
            rowDeleted = ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return rowDeleted;
    }
}
