package com.gymapp.service;

import com.gymapp.domain.AuditLog;
import com.gymapp.repo.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository repo;

    /** Joins the caller's transaction, so an audit row is saved only if the change itself is saved. */
    public void log(String actor, String action, String entityType, Long entityId, String details) {
        AuditLog a = new AuditLog();
        a.setActor(actor);
        a.setAction(action);
        a.setEntityType(entityType);
        a.setEntityId(entityId);
        a.setDetails(details != null && details.length() > 500 ? details.substring(0, 500) : details);
        repo.save(a);
    }
}
