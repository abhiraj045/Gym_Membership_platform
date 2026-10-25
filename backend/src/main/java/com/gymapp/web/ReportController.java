package com.gymapp.web;

import com.gymapp.service.ReportService;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** OWNER-only (SecurityConfig). */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
    private final ReportService service;
    private final Clock clock;

    @GetMapping("/outstanding.csv")
    public ResponseEntity<byte[]> outstanding() { return csv(service.outstandingCsv(), "outstanding-fees.csv"); }

    @GetMapping("/payments.csv")
    public ResponseEntity<byte[]> payments(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate t = to != null ? to : LocalDate.now(clock);
        LocalDate f = from != null ? from : t.withDayOfMonth(1);
        return csv(service.paymentsCsv(f, t), "payments-" + f + "-to-" + t + ".csv");
    }

    private ResponseEntity<byte[]> csv(String body, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(("\uFEFF" + body).getBytes(StandardCharsets.UTF_8));
    }
}
