import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.api import reports


class ReportSummaryApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_uses_authenticated_user_and_envelope(self):
        aggregate = AsyncMock(return_value={
            "transaction_count": 1,
            "income_total": 0.0,
            "expense_total": 100000.0,
            "net_total": -100000.0,
            "expense_by_category": [{"category": "Food", "amount": 100000.0}],
        })
        with patch.object(reports.auth_service, "get_current_user", AsyncMock(return_value={"user_id": "user-a"})) as current_user, \
             patch.object(reports.txs, "aggregate_report_summary", aggregate):
            response = await reports.report_summary("2026-08-01", "2026-08-24", "Bearer token")

        current_user.assert_awaited_once_with("Bearer token")
        aggregate.assert_awaited_once_with("user-a", "2026-08-01", "2026-08-25")
        self.assertEqual(response["data"]["from_date"], "2026-08-01")
        self.assertEqual(response["data"]["to_date"], "2026-08-24")
        self.assertTrue(response["success"])

    async def test_summary_rejects_invalid_or_reversed_dates(self):
        for from_date, to_date in [
            ("2026-08-1", "2026-08-24"),
            ("2026-02-30", "2026-08-24"),
            ("2026-08-25", "2026-08-24"),
        ]:
            with self.subTest(from_date=from_date, to_date=to_date):
                with self.assertRaises(HTTPException) as raised:
                    await reports.report_summary(from_date, to_date, "Bearer token")
                self.assertEqual(raised.exception.status_code, 400)

    async def test_summary_accepts_same_day_range(self):
        aggregate = AsyncMock(return_value={
            "transaction_count": 0,
            "income_total": 0.0,
            "expense_total": 0.0,
            "net_total": 0.0,
            "expense_by_category": [],
        })
        with patch.object(reports.auth_service, "get_current_user", AsyncMock(return_value={"user_id": "user-a"})), \
             patch.object(reports.txs, "aggregate_report_summary", aggregate):
            await reports.report_summary("2026-08-24", "2026-08-24", "Bearer token")

        aggregate.assert_awaited_once_with("user-a", "2026-08-24", "2026-08-25")
