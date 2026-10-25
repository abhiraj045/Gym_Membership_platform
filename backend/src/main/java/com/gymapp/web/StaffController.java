package com.gymapp.web;

import com.gymapp.dto.Dtos.*;
import com.gymapp.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** All endpoints here are OWNER-only (SecurityConfig). */
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {
    private final UserService service;

    @GetMapping
    public List<UserDto> list() { return service.list(); }

    @PostMapping
    public UserDto create(@RequestBody @Valid CreateStaffRequest r, Authentication auth) { return service.createStaff(r, auth.getName()); }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id, @RequestBody @Valid UpdateStaffRequest r, Authentication auth) {
        return service.updateStaff(id, r, auth.getName());
    }
}
