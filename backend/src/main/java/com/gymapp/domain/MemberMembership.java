package com.gymapp.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A member's subscription. Fee and billing months are copied here so later plan price changes never rewrite history. */
@Entity
@Table(name = "member_membership")
@Getter @Setter @NoArgsConstructor
public class MemberMembership {
    public enum Status { ACTIVE, CANCELLED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "member_id")
    private Member member;
    @ManyToOne @JoinColumn(name = "plan_id")
    private MembershipPlan plan;
    @Column(nullable = false)
    private int billingMonths;
    @Column(nullable = false)
    private BigDecimal fee;
    @Column(nullable = false)
    private LocalDate startDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Status status = Status.ACTIVE;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
