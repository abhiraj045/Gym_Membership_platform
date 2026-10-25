package com.gymapp.service;

import com.gymapp.config.AppProperties;
import com.gymapp.domain.FeeObligation;
import com.gymapp.domain.Member;
import com.gymapp.domain.Notification;
import com.gymapp.dto.Dtos.RunResult;
import com.gymapp.dto.Dtos.OverdueMemberDto;
import com.gymapp.repo.NotificationRepository;
import com.gymapp.repo.ObligationRepository;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * Deliberately NOT @Transactional: each repository call commits on its own, and the (slow) SMTP call never
 * holds a database transaction open. Duplicates are blocked by the unique dedupe_key column.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderService {
    private static final int MAX_AUTO_ATTEMPTS = 5;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    private final ObligationRepository obligations;
    private final NotificationRepository notifications;
    private final MembershipService membershipService;
    private final BillingService billing;
    private final DashboardService dashboard;
    private final EmailService email;
    private final AppProperties props;
    private final Clock clock;

    private enum Outcome { SENT, FAILED, SKIPPED }

    /** @param manual true when the owner clicks "Run now": failed emails are retried regardless of attempt count. */
    public RunResult runAll(boolean manual) {
        LocalDate today = LocalDate.now(clock);
        int upcomingDays = props.reminders().upcomingDays();
        List<String> msgs = new ArrayList<>();
        int sent = 0, failed = 0, skipped = 0;

        membershipService.generateRenewals(today, upcomingDays);

        Map<Long, BigDecimal> paid = billing.paidMapAll();
        for (FeeObligation o : obligations.findAll()) {
            BigDecimal out = o.getAmount().subtract(paid.getOrDefault(o.getId(), BigDecimal.ZERO));
            Member m = o.getMember();
            if (out.signum() <= 0 || m.getStatus() != Member.Status.ACTIVE) continue;

            Notification.Type type;
            String key;
            if (o.getDueDate().isBefore(today)) {
                type = Notification.Type.OVERDUE;
                key = "OVERDUE:" + o.getId() + ":W" + (ChronoUnit.DAYS.between(o.getDueDate(), today) / 7); // repeat weekly
            } else if (!o.getDueDate().isAfter(today.plusDays(upcomingDays))) {
                type = Notification.Type.UPCOMING;
                key = "UPCOMING:" + o.getId(); // once per fee
            } else {
                continue;
            }
            if (m.getEmail() == null || m.getEmail().isBlank()) {
                skipped++;
                msgs.add("Skipped " + m.getFullName() + ": no email address on file.");
                continue;
            }

            String subject = type == Notification.Type.OVERDUE
                    ? "Overdue: your " + props.gymName() + " fee of " + money(out)
                    : "Reminder: " + money(out) + " due on " + DATE.format(o.getDueDate());
            Outcome res = deliver(type, key, o.getId(), m.getId(), m.getEmail(), subject, memberBody(type, o, out, today), manual);
            switch (res) {
                case SENT -> { sent++; msgs.add("Sent " + type + " reminder to " + m.getEmail()); }
                case FAILED -> { failed++; msgs.add("FAILED to email " + m.getEmail() + " - see the log below."); }
                case SKIPPED -> skipped++;
            }
        }

        // owner summary: one per day
        String owner = props.ownerEmail();
        if (owner == null || owner.isBlank()) {
            msgs.add("Owner summary skipped: OWNER_EMAIL is not set.");
        } else {
            var d = dashboard.build();
            Outcome res = deliver(Notification.Type.OWNER_SUMMARY, "OWNER_SUMMARY:" + today, null, null, owner,
                    props.gymName() + " daily summary - " + DATE.format(today), ownerBody(d, today), manual);
            switch (res) {
                case SENT -> { sent++; msgs.add("Sent owner summary to " + owner); }
                case FAILED -> { failed++; msgs.add("FAILED to send owner summary to " + owner); }
                case SKIPPED -> skipped++;
            }
        }
        log.info("Reminder run finished: sent={}, failed={}, skipped={}", sent, failed, skipped);
        return new RunResult(sent, failed, skipped, msgs);
    }

    /** Sends a test email to the owner address (or another address the owner types) and logs it. */
    public Notification sendTest(String to) {
        String recipient = (to == null || to.isBlank()) ? props.ownerEmail() : to.trim();
        if (recipient == null || recipient.isBlank()) throw new IllegalStateException("No recipient: set OWNER_EMAIL.");
        String key = "TEST:" + UUID.randomUUID();
        deliver(Notification.Type.TEST, key, null, null, recipient,
                props.gymName() + " - test email", "Hello!\n\nThis is a test email from " + props.gymName()
                        + ". If you can read this, reminders are configured correctly.", true);
        return notifications.findByDedupeKey(key).orElseThrow();
    }

    private Outcome deliver(Notification.Type type, String key, Long obligationId, Long memberId,
                            String to, String subject, String body, boolean manual) {
        Notification n = notifications.findByDedupeKey(key).orElse(null);
        if (n != null) {
            if (n.getStatus() == Notification.Status.SENT) return Outcome.SKIPPED;
            if (n.getStatus() == Notification.Status.PENDING && n.getCreatedAt().isAfter(Instant.now().minusSeconds(600))) return Outcome.SKIPPED;
            if (n.getStatus() == Notification.Status.FAILED && !manual && n.getAttempts() >= MAX_AUTO_ATTEMPTS) return Outcome.SKIPPED;
        } else {
            n = new Notification();
            n.setType(type);
            n.setDedupeKey(key);
            n.setObligationId(obligationId);
            n.setMemberId(memberId);
            n.setRecipient(to);
            n.setSubject(truncate(subject, 200));
            try {
                n = notifications.saveAndFlush(n);        // unique key: a parallel run loses here and skips
            } catch (DataIntegrityViolationException e) {
                return Outcome.SKIPPED;
            }
        }
        n.setAttempts(n.getAttempts() + 1);
        try {
            email.send(to, subject, body);
            n.setStatus(Notification.Status.SENT);
            n.setSentAt(Instant.now());
            n.setError(null);
            notifications.save(n);
            return Outcome.SENT;
        } catch (Exception e) {
            n.setStatus(Notification.Status.FAILED);
            n.setError(truncate(rootMessage(e), 500));
            notifications.save(n);
            log.warn("Email delivery failed for notification {}: {}", n.getId(), rootMessage(e));
            return Outcome.FAILED;
        }
    }

    private String memberBody(Notification.Type type, FeeObligation o, BigDecimal out, LocalDate today) {
        StringBuilder sb = new StringBuilder("Hi ").append(o.getMember().getFullName()).append(",\n\n");
        if (type == Notification.Type.OVERDUE) {
            long days = ChronoUnit.DAYS.between(o.getDueDate(), today);
            sb.append("Your membership fee at ").append(props.gymName()).append(" is ").append(days)
              .append(days == 1 ? " day" : " days").append(" overdue.\n\n");
        } else {
            sb.append("This is a friendly reminder that your membership fee at ").append(props.gymName()).append(" is due soon.\n\n");
        }
        sb.append("Billing period : ").append(DATE.format(o.getPeriodStart())).append(" to ").append(DATE.format(o.getPeriodEnd())).append('\n')
          .append("Due date       : ").append(DATE.format(o.getDueDate())).append('\n')
          .append("Amount pending : ").append(money(out)).append("\n\n")
          .append("You can pay at the front desk. If you have already paid, please ignore this message.\n\n")
          .append("See you at the gym!\n").append(props.gymName());
        return sb.toString();
    }

    private String ownerBody(com.gymapp.dto.Dtos.DashboardDto d, LocalDate today) {
        StringBuilder sb = new StringBuilder("Daily summary for ").append(DATE.format(today)).append("\n\n")
                .append("Active members       : ").append(d.activeMembers()).append('\n')
                .append("Collected this month : ").append(money(d.collectedThisMonth())).append('\n')
                .append("Total outstanding    : ").append(money(d.totalOutstanding())).append('\n')
                .append("Overdue amount       : ").append(money(d.overdueAmount())).append(" (").append(d.overdueMemberCount()).append(" members)\n")
                .append("Due in next 7 days   : ").append(money(d.dueSoonAmount())).append("\n");
        if (!d.overdueMembers().isEmpty()) {
            sb.append("\nTop overdue members:\n");
            for (OverdueMemberDto m : d.overdueMembers())
                sb.append(" - ").append(m.name()).append(" (").append(m.phone()).append("): ").append(money(m.amount()))
                  .append(", since ").append(DATE.format(m.oldestDueDate())).append('\n');
        }
        return sb.toString();
    }

    private static String money(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN")).format(v);
    }
    private static String truncate(String s, int max) { return s == null ? null : s.length() > max ? s.substring(0, max) : s; }
    private static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null) t = t.getCause();
        return t.getClass().getSimpleName() + ": " + t.getMessage();
    }
}
