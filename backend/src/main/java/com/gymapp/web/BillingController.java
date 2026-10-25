package com.gymapp.web;

import com.gymapp.config.AppProperties;
import com.gymapp.dto.Dtos.*;
import com.gymapp.service.BillingService;
import com.gymapp.service.MembershipService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BillingController {
    private final MembershipService memberships;
    private final BillingService billing;
    private final AppProperties props;

    @GetMapping("/plans")
    public List<PlanDto> plans() { return memberships.listPlans(); }

    @PostMapping("/plans")   // OWNER only (SecurityConfig)
    public PlanDto createPlan(@RequestBody @Valid PlanRequest r, Authentication auth) { return memberships.createPlan(r, auth.getName()); }

    @PostMapping("/memberships")
    public MembershipDto createMembership(@RequestBody @Valid MembershipRequest r, Authentication auth) {
        return memberships.create(r, auth.getName());
    }

    @PostMapping("/memberships/{id}/cancel")
    public MembershipDto cancel(@PathVariable Long id, Authentication auth) { return memberships.cancel(id, auth.getName()); }

    @GetMapping("/fees")
    public PageResponse<ObligationDto> fees(@RequestParam(required = false) String q,
                                            @RequestParam(defaultValue = "ALL") String filter,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "10") int size) {
        return billing.searchOutstanding(q, filter, Math.max(page, 0), Math.max(size, 1), props.reminders().upcomingDays() + 4);
    }
}
