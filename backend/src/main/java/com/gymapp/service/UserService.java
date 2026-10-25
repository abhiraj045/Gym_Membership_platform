package com.gymapp.service;

import com.gymapp.config.AppProperties;
import com.gymapp.domain.AppUser;
import com.gymapp.dto.Dtos.*;
import com.gymapp.exception.ApiException;
import com.gymapp.repo.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AppProperties props;
    private final AuditService audit;

    public static UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(), u.getRole().name(), u.isActive());
    }

    @Transactional(readOnly = true)
    public boolean setupRequired() { return users.count() == 0; }

    /** One-time owner creation. Needs the SETUP_TOKEN secret and only works while no users exist. */
    @Transactional
    public UserDto setupOwner(SetupRequest r) {
        String token = props.setupToken();
        if (token == null || token.isBlank())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Setup is disabled: set the SETUP_TOKEN environment variable.");
        if (users.count() > 0) throw ApiException.conflict("Setup has already been completed.");
        boolean ok = MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), r.setupToken().getBytes(StandardCharsets.UTF_8));
        if (!ok) throw new ApiException(HttpStatus.FORBIDDEN, "Invalid setup token.");
        AppUser u = build(r.username(), r.fullName(), r.email(), r.password(), AppUser.Role.OWNER);
        users.save(u);
        audit.log(u.getUsername(), "SETUP_OWNER", "USER", u.getId(), "Owner account created");
        return toDto(u);
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() { return users.findAllByOrderByIdAsc().stream().map(UserService::toDto).toList(); }

    @Transactional
    public UserDto createStaff(CreateStaffRequest r, String actor) {
        if (users.existsByUsernameIgnoreCase(r.username().trim())) throw ApiException.conflict("Username already exists.");
        AppUser u = build(r.username(), r.fullName(), r.email(), r.password(), AppUser.Role.STAFF);
        users.save(u);
        audit.log(actor, "CREATE_STAFF", "USER", u.getId(), "username=" + u.getUsername());
        return toDto(u);
    }

    @Transactional
    public UserDto updateStaff(Long id, UpdateStaffRequest r, String actor) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
        if (u.getRole() == AppUser.Role.OWNER) throw ApiException.badRequest("The owner account cannot be changed here.");
        u.setFullName(r.fullName().trim());
        u.setEmail(blankToNull(r.email()));
        if (r.active() != null) u.setActive(r.active());
        if (r.newPassword() != null && !r.newPassword().isBlank()) u.setPasswordHash(encoder.encode(r.newPassword()));
        audit.log(actor, "UPDATE_STAFF", "USER", u.getId(),
                "active=" + u.isActive() + (r.newPassword() != null && !r.newPassword().isBlank() ? ", password reset" : ""));
        return toDto(u);
    }

    private AppUser build(String username, String fullName, String email, String rawPassword, AppUser.Role role) {
        AppUser u = new AppUser();
        u.setUsername(username.trim().toLowerCase());
        u.setFullName(fullName.trim());
        u.setEmail(blankToNull(email));
        u.setPasswordHash(encoder.encode(rawPassword));
        u.setRole(role);
        return u;
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim().toLowerCase(); }
}
