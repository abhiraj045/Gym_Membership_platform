package com.gymapp.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Append-only ledger row. A correction is a NEGATIVE row pointing at the original via reversesPaymentId. */
@Entity
@Table(name = "payment")
@Getter @Setter @NoArgsConstructor
public class Payment {
    public enum Method { CASH, UPI, CARD, BANK_TRANSFER, OTHER }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "obligation_id")
    private FeeObligation obligation;
    @Column(nullable = false)
    private BigDecimal amount;
    @Column(nullable = false)
    private LocalDate paidOn;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Method method;
    private String reference;
    private Long reversesPaymentId;
    private String note;
    @Column(nullable = false)
    private String recordedBy;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
