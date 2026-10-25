package com.gymapp.service;

import com.gymapp.domain.FeeObligation;
import com.gymapp.dto.Dtos.ObligationDto;
import com.gymapp.dto.Dtos.PageResponse;
import com.gymapp.repo.ObligationRepository;
import com.gymapp.repo.PaymentRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** All fee maths lives here (and only here). The frontend just displays what this returns. */
@Service
@RequiredArgsConstructor
public class BillingService {
    private final ObligationRepository obligations;
    private final PaymentRepository payments;
    private final Clock clock;

    // ---- pure helpers (unit tested) ----

    /** Start of the Nth billing period, always counted from the ORIGINAL start date so day 31 never drifts. */
    public static LocalDate periodStart(LocalDate membershipStart, int months, long index) {
        return membershipStart.plusMonths(months * index);
    }

    public static LocalDate periodEnd(LocalDate membershipStart, int months, long index) {
        return periodStart(membershipStart, months, index + 1).minusDays(1);
    }

    public static String status(BigDecimal amount, BigDecimal paid, LocalDate due, LocalDate today) {
        if (paid.compareTo(amount) >= 0) return "PAID";
        if (due.isBefore(today)) return "OVERDUE";
        return paid.signum() > 0 ? "PARTIAL" : "PENDING";
    }

    // ---- DB-backed helpers ----

    public Map<Long, BigDecimal> paidMap(Collection<Long> obligationIds) {
        if (obligationIds.isEmpty()) return Map.of();
        return toMap(payments.sumsFor(obligationIds));
    }

    public Map<Long, BigDecimal> paidMapAll() {
        return toMap(payments.sumsAll());
    }

    private static Map<Long, BigDecimal> toMap(List<Object[]> rows) {
        Map<Long, BigDecimal> m = new HashMap<>();
        for (Object[] r : rows) m.put((Long) r[0], (BigDecimal) r[1]);
        return m;
    }

    public ObligationDto toDto(FeeObligation o, BigDecimal paid) {
        BigDecimal outstanding = o.getAmount().subtract(paid).max(BigDecimal.ZERO);
        return new ObligationDto(o.getId(), o.getMembership().getId(), o.getMember().getId(), o.getMember().getFullName(),
                o.getMember().getPhone(), o.getPeriodStart(), o.getPeriodEnd(), o.getDueDate(),
                o.getAmount(), paid, outstanding, status(o.getAmount(), paid, o.getDueDate(), LocalDate.now(clock)));
    }

    @Transactional(readOnly = true)
    public Map<Long, BigDecimal> outstandingByMember(Collection<Long> memberIds) {
        if (memberIds.isEmpty()) return Map.of();
        List<FeeObligation> obs = obligations.findByMemberIdIn(memberIds);
        Map<Long, BigDecimal> paid = paidMap(obs.stream().map(FeeObligation::getId).toList());
        Map<Long, BigDecimal> result = new HashMap<>();
        for (FeeObligation o : obs) {
            BigDecimal out = o.getAmount().subtract(paid.getOrDefault(o.getId(), BigDecimal.ZERO)).max(BigDecimal.ZERO);
            result.merge(o.getMember().getId(), out, BigDecimal::add);
        }
        return result;
    }

    /** Fees page: filter = OVERDUE | DUE_SOON | ALL (all unpaid). Simple in-memory paging - fine for a single gym. */
    @Transactional(readOnly = true)
    public PageResponse<ObligationDto> searchOutstanding(String q, String filter, int page, int size, int soonDays) {
        LocalDate today = LocalDate.now(clock);
        Map<Long, BigDecimal> paid = paidMapAll();
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<ObligationDto> list = obligations.findAll().stream()
                .map(o -> toDto(o, paid.getOrDefault(o.getId(), BigDecimal.ZERO)))
                .filter(d -> d.outstanding().signum() > 0)
                .filter(d -> switch (filter == null ? "ALL" : filter) {
                    case "OVERDUE" -> d.dueDate().isBefore(today);
                    case "DUE_SOON" -> !d.dueDate().isBefore(today) && !d.dueDate().isAfter(today.plusDays(soonDays));
                    default -> true;
                })
                .filter(d -> needle.isEmpty() || d.memberName().toLowerCase().contains(needle) || d.memberPhone().contains(needle))
                .sorted(Comparator.comparing(ObligationDto::dueDate))
                .toList();
        return PageResponse.slice(list, page, size);
    }
}
