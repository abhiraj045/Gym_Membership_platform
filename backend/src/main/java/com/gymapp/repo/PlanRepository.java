package com.gymapp.repo;

import com.gymapp.domain.MembershipPlan;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanRepository extends JpaRepository<MembershipPlan, Long> {
    List<MembershipPlan> findByActiveTrueOrderByDurationMonthsAsc();
    boolean existsByNameIgnoreCase(String name);
}
