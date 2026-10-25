package com.gymapp.web;

import com.gymapp.domain.Member;
import com.gymapp.dto.Dtos.*;
import com.gymapp.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService service;

    @GetMapping
    public PageResponse<MemberDto> search(@RequestParam(required = false) String q,
                                          @RequestParam(required = false) Member.Status status,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "10") int size) {
        return service.search(q, status, Math.max(page, 0), Math.max(size, 1));
    }

    @GetMapping("/{id}")
    public MemberDetailDto detail(@PathVariable Long id) { return service.detail(id); }

    @PostMapping
    public MemberDto create(@RequestBody @Valid MemberRequest r, Authentication auth) { return service.create(r, auth.getName()); }

    @PutMapping("/{id}")
    public MemberDto update(@PathVariable Long id, @RequestBody @Valid MemberRequest r, Authentication auth) {
        return service.update(id, r, auth.getName());
    }

    @PostMapping("/{id}/deactivate")
    public MemberDto deactivate(@PathVariable Long id, Authentication auth) {
        return service.setStatus(id, Member.Status.INACTIVE, auth.getName());
    }

    @PostMapping("/{id}/activate")
    public MemberDto activate(@PathVariable Long id, Authentication auth) {
        return service.setStatus(id, Member.Status.ACTIVE, auth.getName());
    }
}
