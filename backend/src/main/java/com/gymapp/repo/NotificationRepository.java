package com.gymapp.repo;

import com.gymapp.domain.Notification;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByDedupeKey(String dedupeKey);
}
