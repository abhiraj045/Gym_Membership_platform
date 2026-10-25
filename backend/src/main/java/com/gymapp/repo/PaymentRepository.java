package com.gymapp.repo;

import com.gymapp.domain.Payment;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    @Query("select sum(p.amount) from Payment p where p.obligation.id = :id")
    BigDecimal sumForObligation(@Param("id") Long obligationId);

    @Query("select p.obligation.id, sum(p.amount) from Payment p group by p.obligation.id")
    List<Object[]> sumsAll();

    @Query("select p.obligation.id, sum(p.amount) from Payment p where p.obligation.id in :ids group by p.obligation.id")
    List<Object[]> sumsFor(@Param("ids") Collection<Long> ids);

    @Query("select p from Payment p where p.obligation.member.id = :memberId order by p.id desc")
    List<Payment> findByMember(@Param("memberId") Long memberId);

    boolean existsByReference(String reference);
    boolean existsByReversesPaymentId(Long paymentId);
    List<Payment> findByPaidOnGreaterThanEqual(LocalDate from);
    List<Payment> findByPaidOnBetweenOrderByPaidOnAscIdAsc(LocalDate from, LocalDate to);
}
