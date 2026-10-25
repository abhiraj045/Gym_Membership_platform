package com.gymapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class BillingServiceTest {

    @Test
    void monthlyPeriodEndsDayBeforeNextStart() {
        assertEquals(LocalDate.of(2026, 11, 14), BillingService.periodEnd(LocalDate.of(2026, 10, 15), 1, 0));
    }

    @Test
    void sixMonthPeriodsAreCountedFromOriginalStart() {
        LocalDate start = LocalDate.of(2026, 1, 10);
        assertEquals(LocalDate.of(2026, 7, 10), BillingService.periodStart(start, 6, 1));
        assertEquals(LocalDate.of(2026, 7, 9), BillingService.periodEnd(start, 6, 0));
    }

    @Test
    void dayThirtyOneDoesNotDriftAcrossShortMonths() {
        LocalDate start = LocalDate.of(2026, 1, 31);
        assertEquals(LocalDate.of(2026, 2, 28), BillingService.periodStart(start, 1, 1));
        assertEquals(LocalDate.of(2026, 3, 31), BillingService.periodStart(start, 1, 2));
    }

    @Test
    void statusReflectsPartialPaymentAndDueDate() {
        LocalDate today = LocalDate.of(2026, 10, 25);
        BigDecimal fee = new BigDecimal("1000.00");
        assertEquals("PAID", BillingService.status(fee, new BigDecimal("1000.00"), today.minusDays(5), today));
        assertEquals("OVERDUE", BillingService.status(fee, new BigDecimal("400.00"), today.minusDays(1), today));
        assertEquals("PARTIAL", BillingService.status(fee, new BigDecimal("400.00"), today.plusDays(2), today));
        assertEquals("PENDING", BillingService.status(fee, BigDecimal.ZERO, today, today));
    }

    @Test
    void csvCellsNeutraliseFormulas() {
        assertEquals("\"'=SUM(A1)\"", ReportService.cell("=SUM(A1)"));
        assertEquals("\"-250.00\"", ReportService.cell(new BigDecimal("-250.00")));
        assertEquals("\"a \"\"b\"\"\"", ReportService.cell("a \"b\""));
    }
}
