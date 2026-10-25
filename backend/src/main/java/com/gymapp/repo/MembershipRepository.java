package com.gymapp.repo;

import com.gymapp.domain.MemberMembership;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<MemberMembership, Long> {
    List<MemberMembership> findByMemberIdOrderByIdDesc(Long memberId);
    List<MemberMembership> findByStatus(MemberMembership.Status status);
    boolean existsByMemberIdAndStatus(Long memberId, MemberMembership.Status status);
}
