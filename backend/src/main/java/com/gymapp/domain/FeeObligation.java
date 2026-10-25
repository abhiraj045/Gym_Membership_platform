package com.gymapp.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** What a member owes for ONE billing period. Unique per (membership, period_start). */
@Entity
@Table(name = "fee_obligation")
@Getter @Setter @NoArgsConstructor
public class FeeObligation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "membership_id")
    private MemberMembership membership;
    @ManyToOne(optional = false) @JoinColumn(name = "member_id")
    private Member member;
    @Column(nullable = false)
    private LocalDate periodStart;
    @Column(nullable = false)
    private LocalDate periodEnd;
    @Column(nullable = false)
    private LocalDate dueDate;
    @Column(nullable = false)
    private BigDecimal amount;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
