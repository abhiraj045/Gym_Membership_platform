package com.gymapp.web;

import com.gymapp.dto.Dtos.*;
import com.gymapp.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService service;

    @PostMapping
    public PaymentDto record(@RequestBody @Valid PaymentRequest r, Authentication auth) { return service.record(r, auth.getName()); }

    @PostMapping("/{id}/reverse")   // OWNER only (SecurityConfig)
    public PaymentDto reverse(@PathVariable Long id, @RequestBody @Valid ReverseRequest r, Authentication auth) {
        return service.reverse(id, r.reason(), auth.getName());
    }
}
