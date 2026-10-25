package com.gymapp.security;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Simple in-memory brute-force guard: 5 failed logins in 15 minutes blocks that IP or that username. */
@Component
public class LoginRateLimiter {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public static String ipKey(HttpServletRequest r) { return "ip:" + r.getRemoteAddr(); }
    public static String userKey(HttpServletRequest r) {
        String u = r.getParameter("username");
        return "user:" + (u == null ? "" : u.trim().toLowerCase());
    }

    public boolean isBlocked(String... keys) {
        for (String k : keys) if (recent(k) >= MAX_FAILURES) return true;
        return false;
    }

    public void recordFailure(String... keys) {
        for (String k : keys) {
            Deque<Instant> d = failures.computeIfAbsent(k, x -> new ArrayDeque<>());
            synchronized (d) { d.addLast(Instant.now()); }
        }
    }

    public void reset(String key) { failures.remove(key); }

    private int recent(String key) {
        Deque<Instant> d = failures.get(key);
        if (d == null) return 0;
        synchronized (d) {
            Instant cutoff = Instant.now().minus(WINDOW);
            while (!d.isEmpty() && d.peekFirst().isBefore(cutoff)) d.pollFirst();
            return d.size();
        }
    }
}
