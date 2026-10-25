package com.gymapp.web;

import com.gymapp.config.AppProperties;
import com.gymapp.dto.Dtos.*;
import com.gymapp.exception.ApiException;
import com.gymapp.repo.UserRepository;
import com.gymapp.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
    private final AppProperties props;
    private final UserRepository users;
    private final UserService userService;

    @GetMapping("/public/config")
    public PublicConfig config() { return new PublicConfig(props.gymName()); }

    @GetMapping("/auth/me")
    public UserDto me(Authentication auth) {
        return users.findByUsernameIgnoreCase(auth.getName()).map(UserService::toDto)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    @GetMapping("/setup/status")
    public SetupStatus setupStatus() { return new SetupStatus(userService.setupRequired()); }

    @PostMapping("/setup/owner")
    public UserDto setupOwner(@RequestBody @jakarta.validation.Valid SetupRequest r) { return userService.setupOwner(r); }
}
