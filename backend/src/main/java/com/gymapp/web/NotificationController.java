package com.gymapp.web;

import com.gymapp.config.AppProperties;
import com.gymapp.domain.Notification;
import com.gymapp.dto.Dtos.*;
import com.gymapp.repo.NotificationRepository;
import com.gymapp.service.EmailService;
import com.gymapp.service.ReminderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

/** OWNER-only (SecurityConfig). */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationRepository repo;
    private final ReminderService reminders;
    private final EmailService email;
    private final AppProperties props;

    static NotificationDto toDto(Notification n) {
        return new NotificationDto(n.getId(), n.getType().name(), n.getRecipient(), n.getSubject(), n.getStatus().name(),
                n.getError(), n.getAttempts(), n.getCreatedAt(), n.getSentAt());
    }

    @GetMapping
    public PageResponse<NotificationDto> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return PageResponse.of(repo.findAll(PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "id"))).map(NotificationController::toDto));
    }

    @GetMapping("/status")
    public ReminderStatus status() {
        var r = props.reminders();
        return new ReminderStatus(email.isConfigured(), email.fromAddress(), props.ownerEmail(), r.sendHour(),
                props.timezone(), r.upcomingDays(), r.enabled());
    }

    @PostMapping("/run-now")
    public RunResult runNow() { return reminders.runAll(true); }

    @PostMapping("/test-email")
    public NotificationDto testEmail(@RequestBody(required = false) @Valid TestEmailRequest r) {
        return toDto(reminders.sendTest(r == null ? null : r.to()));
    }
}
