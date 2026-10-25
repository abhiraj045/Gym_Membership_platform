package com.gymapp.service;

import com.gymapp.domain.FeeObligation;
import com.gymapp.domain.Payment;
import com.gymapp.repo.ObligationRepository;
import com.gymapp.repo.PaymentRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReportService {
    private final ObligationRepository obligations;
    private final PaymentRepository payments;
    private final BillingService billing;
    private final Clock clock;

    @Transactional(readOnly = true)
    public String outstandingCsv() {
        LocalDate today = LocalDate.now(clock);
        Map<Long, BigDecimal> paid = billing.paidMapAll();
        StringBuilder sb = new StringBuilder("Member,Phone,Email,Period start,Period end,Due date,Amount,Paid,Outstanding,Status\n");
        List<FeeObligation> list = obligations.findAll().stream().sorted(Comparator.comparing(FeeObligation::getDueDate)).toList();
        for (FeeObligation o : list) {
            BigDecimal p = paid.getOrDefault(o.getId(), BigDecimal.ZERO);
            BigDecimal out = o.getAmount().subtract(p);
            if (out.signum() <= 0) continue;
            row(sb, o.getMember().getFullName(), o.getMember().getPhone(), o.getMember().getEmail(),
                    o.getPeriodStart(), o.getPeriodEnd(), o.getDueDate(), o.getAmount(), p, out,
                    BillingService.status(o.getAmount(), p, o.getDueDate(), today));
        }
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public String paymentsCsv(LocalDate from, LocalDate to) {
        StringBuilder sb = new StringBuilder("Payment ID,Date,Member,Amount,Method,Reference,Recorded by,Reverses,Note\n");
        for (Payment p : payments.findByPaidOnBetweenOrderByPaidOnAscIdAsc(from, to)) {
            row(sb, p.getId(), p.getPaidOn(), p.getObligation().getMember().getFullName(), p.getAmount(), p.getMethod(),
                    p.getReference(), p.getRecordedBy(), p.getReversesPaymentId(), p.getNote());
        }
        return sb.toString();
    }

    private static void row(StringBuilder sb, Object... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(cell(cells[i]));
        }
        sb.append('\n');
    }

    /** Quotes values and neutralises spreadsheet formulas (=, +, -, @) so a malicious name can't run in Excel. */
    static String cell(Object o) {
        String s = o == null ? "" : o.toString();
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0 && !s.matches("-?[0-9.]+")) s = "'" + s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
