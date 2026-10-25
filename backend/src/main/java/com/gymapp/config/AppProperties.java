package com.gymapp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(String gymName, String setupToken, String ownerEmail, String mailFrom, String timezone, Reminders reminders) {
    public record Reminders(boolean enabled, String checkCron, int sendHour, int upcomingDays) {}
}
