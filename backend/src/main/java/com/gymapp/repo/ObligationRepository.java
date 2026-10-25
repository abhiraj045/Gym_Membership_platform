package com.gymapp.repo;

import com.gymapp.domain.FeeObligation;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ObligationRepository extends JpaRepository<FeeObligation, Long> {
    List<FeeObligation> findByMemberIdOrderByDueDateDesc(Long memberId);
    List<FeeObligation> findByMemberIdIn(Collection<Long> memberIds);
    long countByMembershipId(Long membershipId);

    /** SELECT ... FOR UPDATE: two cashiers paying the same fee at once are forced to queue. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from FeeObligation o where o.id = :id")
    Optional<FeeObligation> findByIdForUpdate(@Param("id") Long id);
}
