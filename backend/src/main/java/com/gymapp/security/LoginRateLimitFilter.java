package com.gymapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

public class LoginRateLimitFilter extends OncePerRequestFilter {
    private final LoginRateLimiter limiter;

    public LoginRateLimitFilter(LoginRateLimiter limiter) { this.limiter = limiter; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("POST".equals(req.getMethod()) && "/api/auth/login".equals(req.getServletPath())
                && limiter.isBlocked(LoginRateLimiter.ipKey(req), LoginRateLimiter.userKey(req))) {
            res.setStatus(429);
            res.setContentType("application/json");
            res.getWriter().write("{\"message\":\"Too many failed attempts. Try again in 15 minutes.\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
