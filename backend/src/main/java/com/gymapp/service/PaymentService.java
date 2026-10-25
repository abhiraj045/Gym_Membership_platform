package com.gymapp.service;

import com.gymapp.domain.FeeObligation;
import com.gymapp.domain.Payment;
import com.gymapp.dto.Dtos.*;
import com.gymapp.exception.ApiException;
import com.gymapp.repo.ObligationRepository;
import com.gymapp.repo.PaymentRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentService {
    private final PaymentRepository payments;
    private final ObligationRepository obligations;
    private final AuditService audit;
    private final Clock clock;

    public static PaymentDto toDto(Payment p, boolean reversed) {
        var o = p.getObligation();
        return new PaymentDto(p.getId(), o.getId(), o.getMember().getId(), o.getMember().getFullName(), p.getAmount(),
                p.getPaidOn(), p.getMethod().name(), p.getReference(), p.getNote(), p.getRecordedBy(),
                p.getReversesPaymentId(), reversed, p.getCreatedAt());
    }

    @Transactional
    public PaymentDto record(PaymentRequest r, String actor) {
        // Lock the fee row: concurrent payments for the same fee run one after another, so the balance check is reliable.
        FeeObligation ob = obligations.findByIdForUpdate(r.obligationId())
                .orElseThrow(() -> ApiException.notFound("Fee not found"));
        if (r.paidOn().isAfter(LocalDate.now(clock))) throw ApiException.badRequest("Payment date cannot be in the future.");

        BigDecimal paid = nz(payments.sumForObligation(ob.getId()));
        BigDecimal outstanding = ob.getAmount().subtract(paid);
        if (outstanding.signum() <= 0) throw ApiException.conflict("This fee is already fully paid.");
        if (r.amount().compareTo(outstanding) > 0)
            throw ApiException.badRequest("Amount is more than the outstanding balance of " + outstanding.toPlainString() + ".");

        String ref = r.reference() == null || r.reference().isBlank() ? null : r.reference().trim();
        if (ref != null && payments.existsByReference(ref)) throw ApiException.conflict("This reference number was already recorded.");

        Payment p = new Payment();
        p.setObligation(ob);
        p.setAmount(r.amount());
        p.setPaidOn(r.paidOn());
        p.setMethod(r.method());
        p.setReference(ref);
        p.setNote(r.note() == null || r.note().isBlank() ? null : r.note().trim());
        p.setRecordedBy(actor);
        try {
            payments.saveAndFlush(p);   // the unique index on reference is the final safety net
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("This reference number was already recorded.");
        }
        audit.log(actor, "RECORD_PAYMENT", "PAYMENT", p.getId(), "obligation=" + ob.getId() + ", amount=" + p.getAmount());
        return toDto(p, false);
    }

    /** Auditable correction: never edits or deletes the original, adds a negative row instead. */
    @Transactional
    public PaymentDto reverse(Long paymentId, String reason, String actor) {
        Payment original = payments.findById(paymentId).orElseThrow(() -> ApiException.notFound("Payment not found"));
        obligations.findByIdForUpdate(original.getObligation().getId());   // serialise with other payments on this fee
        if (original.getAmount().signum() <= 0) throw ApiException.badRequest("A reversal cannot be reversed.");
        if (payments.existsByReversesPaymentId(paymentId)) throw ApiException.conflict("This payment was already reversed.");

        Payment rev = new Payment();
        rev.setObligation(original.getObligation());
        rev.setAmount(original.getAmount().negate());
        rev.setPaidOn(LocalDate.now(clock));
        rev.setMethod(original.getMethod());
        rev.setReversesPaymentId(paymentId);
        rev.setNote(reason.trim());
        rev.setRecordedBy(actor);
        try {
            payments.saveAndFlush(rev);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("This payment was already reversed.");
        }
        audit.log(actor, "REVERSE_PAYMENT", "PAYMENT", paymentId, "reversal=" + rev.getId() + ", reason=" + reason);
        return toDto(rev, false);
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
}
