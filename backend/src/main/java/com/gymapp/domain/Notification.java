package com.gymapp.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "notification")
@Getter @Setter @NoArgsConstructor
public class Notification {
    public enum Type { UPCOMING, OVERDUE, OWNER_SUMMARY, TEST }
    public enum Status { PENDING, SENT, FAILED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Type type;
    /** Unique key such as UPCOMING:42 or OWNER_SUMMARY:2026-10-25 - the database refuses a second row. */
    @Column(nullable = false, unique = true)
    private String dedupeKey;
    private Long obligationId;
    private Long memberId;
    @Column(nullable = false)
    private String recipient;
    @Column(nullable = false)
    private String subject;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Status status = Status.PENDING;
    private String error;
    @Column(nullable = false)
    private int attempts;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    private Instant sentAt;
}
