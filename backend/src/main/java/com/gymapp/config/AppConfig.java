package com.gymapp.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {
    /** One clock for the whole app so "today" always means the gym's local date. */
    @Bean
    Clock clock(AppProperties props) {
        return Clock.system(ZoneId.of(props.timezone()));
    }
}
