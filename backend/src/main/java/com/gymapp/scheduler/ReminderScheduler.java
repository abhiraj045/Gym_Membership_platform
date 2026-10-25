package com.gymapp.scheduler;

import com.gymapp.config.AppProperties;
import com.gymapp.dto.Dtos.RunResult;
import com.gymapp.service.ReminderService;
import java.time.Clock;
import java.time.LocalTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs hourly AND once at startup. Each run does nothing before the configured send hour; after it, the dedupe keys
 * guarantee each reminder goes out once. If a free host was asleep at 9am, the first wake-up after 9am still sends.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.reminders", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReminderScheduler {
    private final ReminderService reminders;
    private final AppProperties props;
    private final Clock clock;

    @Scheduled(cron = "${app.reminders.check-cron}", zone = "${app.timezone}")
    public void scheduledCheck() { run("scheduled check"); }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() { run("startup catch-up"); }

    private void run(String why) {
        if (LocalTime.now(clock).getHour() < props.reminders().sendHour()) {
            log.info("Reminder {}: before send hour {}, nothing to do yet", why, props.reminders().sendHour());
            return;
        }
        try {
            RunResult r = reminders.runAll(false);
            log.info("Reminder {} done: sent={}, failed={}, skipped={}", why, r.sent(), r.failed(), r.skipped());
        } catch (Exception e) {
            log.error("Reminder {} failed", why, e);
        }
    }
}
