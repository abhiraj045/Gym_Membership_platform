package com.gymapp.service;

import com.gymapp.config.AppProperties;
import com.gymapp.domain.FeeObligation;
import com.gymapp.domain.Member;
import com.gymapp.domain.MemberMembership;
import com.gymapp.domain.Payment;
import com.gymapp.dto.Dtos.*;
import com.gymapp.repo.MemberRepository;
import com.gymapp.repo.ObligationRepository;
import com.gymapp.repo.PaymentRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final MemberRepository members;
    private final ObligationRepository obligations;
    private final PaymentRepository payments;
    private final BillingService billing;
    private final AppProperties props;
    private final Clock clock;

    @Transactional(readOnly = true)
    public DashboardDto build() {
        LocalDate today = LocalDate.now(clock);
        LocalDate soon = today.plusDays(7);
        Map<Long, BigDecimal> paid = billing.paidMapAll();

        BigDecimal overdue = BigDecimal.ZERO, dueSoon = BigDecimal.ZERO, outstandingTotal = BigDecimal.ZERO;
        Map<Long, OverdueAcc> overdueByMember = new HashMap<>();
        List<RenewalDto> renewing = new ArrayList<>();

        for (FeeObligation o : obligations.findAll()) {
            BigDecimal out = o.getAmount().subtract(paid.getOrDefault(o.getId(), BigDecimal.ZERO)).max(BigDecimal.ZERO);
            if (out.signum() > 0) {
                outstandingTotal = outstandingTotal.add(out);
                if (o.getDueDate().isBefore(today)) {
                    overdue = overdue.add(out);
                    overdueByMember.computeIfAbsent(o.getMember().getId(), k -> new OverdueAcc(o.getMember())).add(out, o.getDueDate());
                } else if (!o.getDueDate().isAfter(soon)) {
                    dueSoon = dueSoon.add(out);
                }
            }
            boolean current = !o.getPeriodStart().isAfter(today) && !o.getPeriodEnd().isBefore(today);
            if (current && !o.getPeriodEnd().isAfter(soon)
                    && o.getMembership().getStatus() == MemberMembership.Status.ACTIVE
                    && o.getMember().getStatus() == Member.Status.ACTIVE) {
                renewing.add(new RenewalDto(o.getMember().getId(), o.getMember().getFullName(), o.getPeriodEnd(), o.getMembership().getFee()));
            }
        }
        renewing.sort(Comparator.comparing(RenewalDto::periodEnd));

        List<OverdueMemberDto> overdueList = overdueByMember.values().stream()
                .map(OverdueAcc::toDto)
                .sorted(Comparator.comparing(OverdueMemberDto::amount).reversed())
                .toList();

        BigDecimal totalCollected = paid.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        // last 6 calendar months of collections (net of reversals)
        YearMonth thisMonth = YearMonth.from(today);
        Map<YearMonth, BigDecimal> byMonth = new LinkedHashMap<>();
        for (int i = 5; i >= 0; i--) byMonth.put(thisMonth.minusMonths(i), BigDecimal.ZERO);
        for (Payment p : payments.findByPaidOnGreaterThanEqual(thisMonth.minusMonths(5).atDay(1))) {
            byMonth.merge(YearMonth.from(p.getPaidOn()), p.getAmount(), BigDecimal::add);
        }
        List<MonthlyCollection> monthly = byMonth.entrySet().stream()
                .map(e -> new MonthlyCollection(e.getKey().toString(), e.getValue())).toList();

        return new DashboardDto(
                members.countByStatus(Member.Status.ACTIVE), members.countByStatus(Member.Status.INACTIVE),
                totalCollected, byMonth.get(thisMonth), outstandingTotal, overdue, dueSoon,
                overdueList.size(), overdueList.stream().limit(10).toList(),
                renewing.stream().limit(10).toList(), monthly);
    }

    private static class OverdueAcc {
        final Member m; BigDecimal amount = BigDecimal.ZERO; LocalDate oldest; int count;
        OverdueAcc(Member m) { this.m = m; }
        void add(BigDecimal a, LocalDate due) {
            amount = amount.add(a); count++;
            if (oldest == null || due.isBefore(oldest)) oldest = due;
        }
        OverdueMemberDto toDto() { return new OverdueMemberDto(m.getId(), m.getFullName(), m.getPhone(), m.getEmail(), amount, oldest, count); }
    }
}
