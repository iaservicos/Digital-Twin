package br.com.positivo.digitaltwin.modules.brilhamais.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> checkHealth() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("timestamp", LocalDateTime.now());

        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            status.put("database", "CONNECTED");
        } catch (Exception e) {
            status.put("database", "DISCONNECTED: " + e.getMessage());
            status.put("status", "DEGRADED");
        }

        return ResponseEntity.ok(status);
    }
}
