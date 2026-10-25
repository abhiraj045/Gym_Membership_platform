package com.gymapp.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "audit_log")
@Getter @Setter @NoArgsConstructor
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String actor;
    @Column(nullable = false)
    private String action;
    @Column(nullable = false)
    private String entityType;
    private Long entityId;
    private String details;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
