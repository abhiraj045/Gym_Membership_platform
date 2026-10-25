package com.gymapp.service;

import com.gymapp.config.AppProperties;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/** Works with any SMTP provider (Brevo, Gmail, Mailjet...): login comes from MAIL_USERNAME/MAIL_PASSWORD, the visible sender from MAIL_FROM. */
@Service
@RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender sender;
    private final AppProperties props;

    @Value("${spring.mail.username:}")
    private String smtpLogin;

    public boolean isConfigured() {
        return smtpLogin != null && !smtpLogin.isBlank() && props.mailFrom() != null && !props.mailFrom().isBlank();
    }

    public String fromAddress() { return props.mailFrom(); }

    /** Throws on any failure so the caller can record the error in the notification table. */
    public void send(String to, String subject, String body) throws Exception {
        if (!isConfigured()) throw new IllegalStateException("MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM are not configured");
        MimeMessage msg = sender.createMimeMessage();
        MimeMessageHelper h = new MimeMessageHelper(msg, false, "UTF-8");
        h.setFrom(props.mailFrom(), props.gymName());
        h.setTo(to);
        h.setSubject(subject);
        h.setText(body, false);
        sender.send(msg);
    }
}
