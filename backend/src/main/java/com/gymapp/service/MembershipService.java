package com.gymapp.service;

import com.gymapp.config.AppProperties;
import com.gymapp.domain.*;
import com.gymapp.dto.Dtos.*;
import com.gymapp.exception.ApiException;
import com.gymapp.repo.*;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MembershipService {
    private final MembershipRepository memberships;
    private final PlanRepository plans;
    private final MemberRepository members;
    private final ObligationRepository obligations;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public static MembershipDto toDto(MemberMembership m) {
        return new MembershipDto(m.getId(), m.getMember().getId(), m.getMember().getFullName(),
                m.getPlan() == null ? null : m.getPlan().getId(),
                m.getPlan() == null ? "Custom" : m.getPlan().getName(),
                m.getBillingMonths(), m.getFee(), m.getStartDate(), m.getStatus().name());
    }

    @Transactional(readOnly = true)
    public List<PlanDto> listPlans() {
        return plans.findByActiveTrueOrderByDurationMonthsAsc().stream()
                .map(p -> new PlanDto(p.getId(), p.getName(), p.getDurationMonths(), p.getDefaultFee())).toList();
    }

    @Transactional
    public PlanDto createPlan(PlanRequest r, String actor) {
        if (plans.existsByNameIgnoreCase(r.name().trim())) throw ApiException.conflict("A plan with this name already exists.");
        MembershipPlan p = new MembershipPlan();
        p.setName(r.name().trim());
        p.setDurationMonths(r.durationMonths());
        p.setDefaultFee(r.defaultFee());
        plans.save(p);
        audit.log(actor, "CREATE_PLAN", "PLAN", p.getId(), p.getName());
        return new PlanDto(p.getId(), p.getName(), p.getDurationMonths(), p.getDefaultFee());
    }

    @Transactional
    public MembershipDto create(MembershipRequest r, String actor) {
        Member member = members.findById(r.memberId()).orElseThrow(() -> ApiException.notFound("Member not found"));
        if (member.getStatus() != Member.Status.ACTIVE) throw ApiException.badRequest("Member is inactive. Activate the member first.");
        if (memberships.existsByMemberIdAndStatus(member.getId(), MemberMembership.Status.ACTIVE))
            throw ApiException.conflict("This member already has an active membership. Cancel it first to change plans.");

        MembershipPlan plan = null;
        int months;
        BigDecimal fee;
        if (r.planId() != null) {
            plan = plans.findById(r.planId()).orElseThrow(() -> ApiException.notFound("Plan not found"));
            months = plan.getDurationMonths();
            fee = r.fee() != null ? r.fee() : plan.getDefaultFee();   // per-member fee override
        } else {
            if (r.billingMonths() == null || r.fee() == null)
                throw ApiException.badRequest("A custom membership needs billing months and a fee.");
            months = r.billingMonths();
            fee = r.fee();
        }

        MemberMembership m = new MemberMembership();
        m.setMember(member);
        m.setPlan(plan);
        m.setBillingMonths(months);
        m.setFee(fee);
        m.setStartDate(r.startDate());
        memberships.save(m);
        generateObligations(m, LocalDate.now(clock).plusDays(props.reminders().upcomingDays()));
        audit.log(actor, "CREATE_MEMBERSHIP", "MEMBERSHIP", m.getId(), "member=" + member.getId() + ", fee=" + fee + ", months=" + months);
        return toDto(m);
    }

    @Transactional
    public MembershipDto cancel(Long id, String actor) {
        MemberMembership m = memberships.findById(id).orElseThrow(() -> ApiException.notFound("Membership not found"));
        m.setStatus(MemberMembership.Status.CANCELLED);
        audit.log(actor, "CANCEL_MEMBERSHIP", "MEMBERSHIP", id, "member=" + m.getMember().getId());
        return toDto(m);
    }

    /** Creates every missing billing period whose start date is on/before the cutoff. Safe to call repeatedly. */
    @Transactional
    public int generateObligations(MemberMembership m, LocalDate cutoff) {
        long index = obligations.countByMembershipId(m.getId());
        int created = 0;
        while (true) {
            LocalDate start = BillingService.periodStart(m.getStartDate(), m.getBillingMonths(), index);
            if (start.isAfter(cutoff)) break;
            FeeObligation o = new FeeObligation();
            o.setMembership(m);
            o.setMember(m.getMember());
            o.setPeriodStart(start);
            o.setPeriodEnd(BillingService.periodEnd(m.getStartDate(), m.getBillingMonths(), index));
            o.setDueDate(start);
            o.setAmount(m.getFee());           // snapshot of the fee at the time
            obligations.save(o);
            index++;
            created++;
        }
        return created;
    }

    /** Daily renewal job: create next periods for active memberships of active members. */
    @Transactional
    public int generateRenewals(LocalDate today, int lookaheadDays) {
        int total = 0;
        for (MemberMembership m : memberships.findByStatus(MemberMembership.Status.ACTIVE)) {
            if (m.getMember().getStatus() != Member.Status.ACTIVE) continue;
            total += generateObligations(m, today.plusDays(lookaheadDays));
        }
        return total;
    }
}
