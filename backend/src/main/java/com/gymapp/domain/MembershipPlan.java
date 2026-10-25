package com.gymapp.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "membership_plan")
@Getter @Setter @NoArgsConstructor
public class MembershipPlan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String name;
    @Column(nullable = false)
    private int durationMonths;
    @Column(nullable = false)
    private BigDecimal defaultFee;
    @Column(nullable = false)
    private boolean active = true;
}
