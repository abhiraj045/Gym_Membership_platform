package com.gymapp.dto;

import com.gymapp.domain.Payment;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;

/** Every request/response shape lives here so entities never leak through the API. */
public final class Dtos {
    private Dtos() {}

    // ---- generic ----
    public record ErrorResponse(Instant timestamp, int status, String message, Map<String, String> fieldErrors) {}

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
        public static <T> PageResponse<T> of(Page<T> p) {
            return new PageResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
        }
        public static <T> PageResponse<T> slice(List<T> all, int page, int size) {
            int from = Math.min(page * size, all.size());
            int to = Math.min(from + size, all.size());
            return new PageResponse<>(all.subList(from, to), page, size, all.size(), (int) Math.ceil(all.size() / (double) size));
        }
    }

    // ---- auth / users ----
    public record PublicConfig(String gymName) {}
    public record SetupStatus(boolean setupRequired) {}
    public record SetupRequest(
            @NotBlank String setupToken,
            @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Username may use letters, digits, . _ - only") String username,
            @NotBlank @Size(max = 100) String fullName,
            @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 10, max = 72, message = "Password must be 10-72 characters") String password) {}
    public record UserDto(Long id, String username, String fullName, String email, String role, boolean active) {}
    public record CreateStaffRequest(
            @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Username may use letters, digits, . _ - only") String username,
            @NotBlank @Size(max = 100) String fullName,
            @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 10, max = 72, message = "Password must be 10-72 characters") String password) {}
    public record UpdateStaffRequest(
            @NotBlank @Size(max = 100) String fullName,
            @Email @Size(max = 150) String email,
            Boolean active,
            @Size(min = 10, max = 72, message = "Password must be 10-72 characters") String newPassword) {}

    // ---- members ----
    public record MemberRequest(
            @NotBlank @Size(max = 100) String fullName,
            @NotBlank @Pattern(regexp = "^[0-9+\\- ]{7,20}$", message = "Phone must be 7-20 digits (+, - and spaces allowed)") String phone,
            @Email @Size(max = 150) String email,
            @NotNull LocalDate joiningDate,
            @Size(max = 500) String notes) {}
    public record MemberDto(Long id, String fullName, String phone, String email, LocalDate joiningDate,
                            String status, String notes, BigDecimal outstanding) {}
    public record MemberDetailDto(MemberDto member, BigDecimal totalFees, BigDecimal totalPaid, BigDecimal outstanding,
                                  List<MembershipDto> memberships, List<ObligationDto> obligations, List<PaymentDto> payments) {}

    // ---- plans / memberships / fees ----
    public record PlanRequest(
            @NotBlank @Size(max = 50) String name,
            @NotNull @Min(1) @Max(120) Integer durationMonths,
            @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal defaultFee) {}
    public record PlanDto(Long id, String name, int durationMonths, BigDecimal defaultFee) {}
    public record MembershipRequest(
            @NotNull Long memberId,
            Long planId,
            @Min(1) @Max(120) Integer billingMonths,
            @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal fee,
            @NotNull LocalDate startDate) {}
    public record MembershipDto(Long id, Long memberId, String memberName, Long planId, String planName,
                                int billingMonths, BigDecimal fee, LocalDate startDate, String status) {}
    public record ObligationDto(Long id, Long membershipId, Long memberId, String memberName, String memberPhone,
                                LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate,
                                BigDecimal amount, BigDecimal paid, BigDecimal outstanding, String status) {}

    // ---- payments ----
    public record PaymentRequest(
            @NotNull Long obligationId,
            @NotNull @DecimalMin(value = "0.01", message = "Amount must be at least 0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @NotNull LocalDate paidOn,
            @NotNull Payment.Method method,
            @Size(max = 100) String reference,
            @Size(max = 255) String note) {}
    public record ReverseRequest(@NotBlank @Size(max = 255) String reason) {}
    public record PaymentDto(Long id, Long obligationId, Long memberId, String memberName, BigDecimal amount,
                             LocalDate paidOn, String method, String reference, String note, String recordedBy,
                             Long reversesPaymentId, boolean reversed, Instant createdAt) {}

    // ---- dashboard ----
    public record OverdueMemberDto(Long memberId, String name, String phone, String email,
                                   BigDecimal amount, LocalDate oldestDueDate, int count) {}
    public record RenewalDto(Long memberId, String name, LocalDate periodEnd, BigDecimal fee) {}
    public record MonthlyCollection(String month, BigDecimal amount) {}
    public record DashboardDto(long activeMembers, long inactiveMembers, BigDecimal totalCollected,
                               BigDecimal collectedThisMonth, BigDecimal totalOutstanding, BigDecimal overdueAmount,
                               BigDecimal dueSoonAmount, long overdueMemberCount, List<OverdueMemberDto> overdueMembers,
                               List<RenewalDto> renewingSoon, List<MonthlyCollection> monthlyCollections) {}

    // ---- notifications ----
    public record NotificationDto(Long id, String type, String recipient, String subject, String status,
                                  String error, int attempts, Instant createdAt, Instant sentAt) {}
    public record RunResult(int sent, int failed, int skipped, List<String> messages) {}
    public record TestEmailRequest(@Email String to) {}
    public record ReminderStatus(boolean mailConfigured, String fromAddress, String ownerEmail, int sendHour,
                                 String timezone, int upcomingDays, boolean schedulerEnabled) {}
}
