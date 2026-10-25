package com.gymapp.config;

import com.gymapp.security.LoginRateLimitFilter;
import com.gymapp.security.LoginRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, LoginRateLimiter limiter) throws Exception {
        // SPA-friendly CSRF: token lives in the XSRF-TOKEN cookie, axios copies it into the X-XSRF-TOKEN header.
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // load the token eagerly so the cookie is always set

        http
            .csrf(c -> c.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler))
            .addFilterBefore(new LoginRateLimitFilter(limiter), UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/setup/**", "/api/public/**", "/error").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers("/api/staff/**", "/api/notifications/**", "/api/reports/**").hasRole("OWNER")
                .requestMatchers(HttpMethod.POST, "/api/plans", "/api/payments/*/reverse").hasRole("OWNER")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .formLogin(f -> f
                .loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, auth) -> {
                    limiter.reset(LoginRateLimiter.userKey(req));
                    res.setStatus(HttpStatus.OK.value());
                })
                .failureHandler((req, res, ex) -> {
                    limiter.recordFailure(LoginRateLimiter.ipKey(req), LoginRateLimiter.userKey(req));
                    res.setStatus(HttpStatus.UNAUTHORIZED.value());
                    res.setContentType("application/json");
                    res.getWriter().write("{\"message\":\"Incorrect username or password.\"}");
                }))
            .logout(l -> l
                .logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(HttpStatus.OK.value())))
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .headers(h -> h
                .contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                .referrerPolicy(r -> r.policy(ReferrerPolicy.NO_REFERRER)));

        return http.build();
    }
}
