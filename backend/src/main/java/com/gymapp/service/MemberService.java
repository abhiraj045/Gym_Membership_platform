package com.gymapp.service;

import com.gymapp.domain.*;
import com.gymapp.dto.Dtos.*;
import com.gymapp.exception.ApiException;
import com.gymapp.repo.*;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberService {
    private final MemberRepository members;
    private final MembershipRepository memberships;
    private final ObligationRepository obligations;
    private final PaymentRepository payments;
    private final BillingService billing;
    private final AuditService audit;

    public static MemberDto toDto(Member m, BigDecimal outstanding) {
        return new MemberDto(m.getId(), m.getFullName(), m.getPhone(), m.getEmail(), m.getJoiningDate(),
                m.getStatus().name(), m.getNotes(), outstanding);
    }

    @Transactional(readOnly = true)
    public PageResponse<MemberDto> search(String q, Member.Status status, int page, int size) {
        Specification<Member> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                ps.add(cb.or(cb.like(cb.lower(root.get("fullName")), like),
                             cb.like(root.get("phone"), like),
                             cb.like(cb.lower(root.get("email")), like)));
            }
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<Member> result = members.findAll(spec, PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "id")));
        Map<Long, BigDecimal> out = billing.outstandingByMember(result.getContent().stream().map(Member::getId).toList());
        return PageResponse.of(result.map(m -> toDto(m, out.getOrDefault(m.getId(), BigDecimal.ZERO))));
    }

    @Transactional(readOnly = true)
    public MemberDetailDto detail(Long id) {
        Member m = find(id);
        List<FeeObligation> obs = obligations.findByMemberIdOrderByDueDateDesc(id);
        Map<Long, BigDecimal> paid = billing.paidMap(obs.stream().map(FeeObligation::getId).toList());
        List<ObligationDto> obDtos = obs.stream().map(o -> billing.toDto(o, paid.getOrDefault(o.getId(), BigDecimal.ZERO))).toList();
        BigDecimal totalFees = obs.stream().map(FeeObligation::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = obDtos.stream().map(ObligationDto::paid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = obDtos.stream().map(ObligationDto::outstanding).reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Payment> pays = payments.findByMember(id);
        Set<Long> reversedIds = pays.stream().map(Payment::getReversesPaymentId).filter(Objects::nonNull).collect(Collectors.toSet());
        List<PaymentDto> payDtos = pays.stream().map(p -> PaymentService.toDto(p, reversedIds.contains(p.getId()))).toList();
        List<MembershipDto> msDtos = memberships.findByMemberIdOrderByIdDesc(id).stream().map(MembershipService::toDto).toList();
        return new MemberDetailDto(toDto(m, outstanding), totalFees, totalPaid, outstanding, msDtos, obDtos, payDtos);
    }

    @Transactional
    public MemberDto create(MemberRequest r, String actor) {
        String phone = r.phone().trim();
        if (members.existsByPhone(phone)) throw ApiException.conflict("A member with this phone number already exists.");
        Member m = new Member();
        apply(m, r);
        members.save(m);
        audit.log(actor, "CREATE_MEMBER", "MEMBER", m.getId(), m.getFullName());
        return toDto(m, BigDecimal.ZERO);
    }

    @Transactional
    public MemberDto update(Long id, MemberRequest r, String actor) {
        Member m = find(id);
        if (members.existsByPhoneAndIdNot(r.phone().trim(), id)) throw ApiException.conflict("Another member already uses this phone number.");
        apply(m, r);
        audit.log(actor, "UPDATE_MEMBER", "MEMBER", id, m.getFullName());
        return toDto(m, BigDecimal.ZERO);
    }

    @Transactional
    public MemberDto setStatus(Long id, Member.Status status, String actor) {
        Member m = find(id);
        m.setStatus(status);
        audit.log(actor, status == Member.Status.ACTIVE ? "ACTIVATE_MEMBER" : "DEACTIVATE_MEMBER", "MEMBER", id, m.getFullName());
        return toDto(m, BigDecimal.ZERO);
    }

    private void apply(Member m, MemberRequest r) {
        m.setFullName(r.fullName().trim());
        m.setPhone(r.phone().trim());
        m.setEmail(r.email() == null || r.email().isBlank() ? null : r.email().trim().toLowerCase());
        m.setJoiningDate(r.joiningDate());
        m.setNotes(r.notes() == null || r.notes().isBlank() ? null : r.notes().trim());
    }

    private Member find(Long id) {
        return members.findById(id).orElseThrow(() -> ApiException.notFound("Member not found"));
    }
}
