package com.gymapp.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "member")
@Getter @Setter @NoArgsConstructor
public class Member {
    public enum Status { ACTIVE, INACTIVE }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String fullName;
    @Column(nullable = false)
    private String phone;
    private String email;
    @Column(nullable = false)
    private LocalDate joiningDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Status status = Status.ACTIVE;
    private String notes;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
