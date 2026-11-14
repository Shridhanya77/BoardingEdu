from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.fees.models import AcademicYear, FeeItem, FeeStructure, FeeTerm
from apps.geography.models import City, Country, State
from apps.schools.models import Grade, School, SchoolGrade, SchoolType


class PublicFeeEstimateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        country = Country.objects.create(
            country_code="IN",
            country_name="India",
            slug="india-fee-estimate",
        )
        state = State.objects.create(
            country=country,
            state_code="KA",
            state_name="Karnataka",
            slug="karnataka-fee-estimate",
        )
        city = City.objects.create(
            state=state,
            city_code="BLR",
            city_name="Bengaluru",
            slug="bengaluru-fee-estimate",
        )
        cls.school_type = SchoolType.objects.get_or_create(
            type_code="DAY",
            defaults={
                "type_name": "Day School",
                "slug": "day-school-fee-estimate",
            },
        )[0]
        cls.grade = Grade.objects.create(
            grade_code="EST1",
            grade_name="Estimate Grade",
            sort_order=(Grade.objects.order_by("-sort_order").values_list("sort_order", flat=True).first() or 0) + 1,
        )
        cls.school = School.objects.create(
            school_code="FEE-ESTIMATE",
            school_name="Estimate School",
            slug="estimate-school",
            country=country,
            state=state,
            city=city,
            address="Bengaluru",
            status=True,
            verification_status="VERIFIED",
            published_at=timezone.now(),
        )
        cls.school.school_types.add(cls.school_type)
        SchoolGrade.objects.create(school=cls.school, grade=cls.grade)
        today = timezone.localdate()
        cls.year = AcademicYear.objects.create(
            year_code="FEE-ESTIMATE-YEAR",
            year_name="Fee Estimate Academic Year",
            start_date=date(today.year, 1, 1),
            end_date=date(today.year, 12, 31),
            is_current=True,
            status=True,
        )
        cls.structure = FeeStructure.objects.create(
            structure_code="FEE-ESTIMATE-STRUCTURE",
            structure_name="Published estimate fees",
            school=cls.school,
            academic_year=cls.year,
            effective_from=today,
            status=True,
            published=True,
        )
        for number in range(1, 4):
            FeeTerm.objects.create(
                academic_year=cls.year,
                term_code=f"TERM-{number}",
                term_name=f"Term {number}",
                term_frequency="TERM",
                start_date=date(today.year, number * 3 - 2, 1),
                end_date=date(today.year, number * 3, 28),
                status=True,
            )
        FeeItem.objects.create(
            fee_structure=cls.structure,
            item_code="ANNUAL",
            item_name="Annual tuition",
            item_category="TUITION",
            amount=Decimal("1000.00"),
            payment_frequency="ANNUAL",
            tax_rate_pct=Decimal("10.00"),
        )
        FeeItem.objects.create(
            fee_structure=cls.structure,
            item_code="QUARTERLY",
            item_name="Quarterly activity fee",
            item_category="EXTRACURRICULAR",
            amount=Decimal("250.00"),
            payment_frequency="QUARTERLY",
        )
        FeeItem.objects.create(
            fee_structure=cls.structure,
            item_code="TERM",
            item_name="Term examination fee",
            item_category="EXAMINATION",
            amount=Decimal("100.00"),
            payment_frequency="TERM",
        )
        FeeItem.objects.create(
            fee_structure=cls.structure,
            item_code="ONE-TIME",
            item_name="Admission fee",
            item_category="ADMISSION",
            amount=Decimal("500.00"),
            payment_frequency="ONE_TIME",
        )
        FeeItem.objects.create(
            fee_structure=cls.structure,
            item_code="VARIABLE",
            item_name="Transport by distance",
            item_category="TRANSPORT",
            amount=None,
            payment_frequency="BY_DISTANCE",
        )

    def test_estimate_annualizes_known_items_and_preserves_variable_fees_as_unknown(self):
        response = self.client.post(
            "/api/fees/estimate/",
            {
                "school_ids": [str(self.school.pk)],
                "grade_id": str(self.grade.pk),
                "school_type_id": str(self.school_type.pk),
                "academic_year_id": str(self.year.pk),
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        estimate = response.data["results"][0]
        self.assertTrue(estimate["fees_available"])
        self.assertFalse(estimate["complete"])
        self.assertIsNone(estimate["annual_total"])
        self.assertIsNone(estimate["first_year_total"])
        self.assertEqual(estimate["known_annual_subtotal"], "2400.00")
        self.assertEqual(estimate["known_one_time_subtotal"], "500.00")
        by_name = {item["item_name"]: item for item in estimate["items"]}
        self.assertEqual(by_name["Annual tuition"]["annualized_amount"], "1100.00")
        self.assertEqual(by_name["Term examination fee"]["annualized_amount"], "300.00")
        self.assertIsNone(by_name["Transport by distance"]["annualized_amount"])

    def test_unpublished_fee_structure_is_not_exposed_by_public_fee_api(self):
        self.structure.published = False
        self.structure.save(update_fields=["published"])

        response = self.client.get("/api/fees/fee-structures/")

        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(rows, [])

    def test_school_with_different_type_returns_unavailable_result(self):
        boarding_type = SchoolType.objects.create(
            type_code="BOARD-ESTIMATE",
            type_name="Fee Estimate Boarding School",
            slug="fee-estimate-boarding-school",
        )

        response = self.client.post(
            "/api/fees/estimate/",
            {
                "school_ids": [str(self.school.pk)],
                "grade_id": str(self.grade.pk),
                "school_type_id": str(boarding_type.pk),
                "academic_year_id": str(self.year.pk),
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        estimate = response.data["results"][0]
        self.assertFalse(estimate["fees_available"])
        self.assertEqual(estimate["items"], [])

    def test_combined_grade_estimate_returns_separate_results_for_each_grade(self):
        pre_nursery = Grade.objects.create(
            grade_code="PN-EST",
            grade_name="Pre-Nursery",
            sort_order=self.grade.sort_order + 1,
        )
        nursery = Grade.objects.create(
            grade_code="NUR-EST",
            grade_name="Nursery",
            sort_order=self.grade.sort_order + 2,
        )
        SchoolGrade.objects.create(school=self.school, grade=pre_nursery)
        SchoolGrade.objects.create(school=self.school, grade=nursery)
        for grade, item_code in (
            (pre_nursery, "PRE-NURSERY-TUITION"),
            (nursery, "NURSERY-TUITION"),
        ):
            FeeItem.objects.create(
                fee_structure=self.structure,
                grade=grade,
                item_code=item_code,
                item_name=f"{grade.grade_name} tuition",
                item_category="TUITION",
                amount=Decimal("1000.00"),
                payment_frequency="ANNUAL",
            )

        response = self.client.post(
            "/api/fees/estimate/",
            {
                "school_ids": [str(self.school.pk)],
                "grade_ids": [str(pre_nursery.pk), str(nursery.pk)],
                "school_type_id": str(self.school_type.pk),
                "academic_year_id": str(self.year.pk),
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        estimates = response.data["results"]
        self.assertEqual([item["grade_name"] for item in estimates], ["Pre-Nursery", "Nursery"])
        self.assertEqual(len(estimates), 2)
        self.assertTrue(all(item["fees_available"] for item in estimates))
        pre_nursery_items = {item["item_name"] for item in estimates[0]["items"]}
        nursery_items = {item["item_name"] for item in estimates[1]["items"]}
        self.assertIn("Pre-Nursery tuition", pre_nursery_items)
        self.assertNotIn("Nursery tuition", pre_nursery_items)
        self.assertIn("Nursery tuition", nursery_items)
        self.assertNotIn("Pre-Nursery tuition", nursery_items)

    def test_grade_eleven_estimate_requires_stream_and_filters_stream_fees(self):
        grade = Grade.objects.create(
            grade_code="G11-EST",
            grade_name="Grade 11",
            sort_order=self.grade.sort_order + 1,
        )
        SchoolGrade.objects.create(school=self.school, grade=grade)
        science_fee = FeeItem.objects.create(
            fee_structure=self.structure,
            grade=grade,
            item_code="SENIOR-TUITION",
            item_name="Science tuition",
            item_category="TUITION",
            amount=Decimal("1000.00"),
            payment_frequency="ANNUAL",
            stream="SCIENCE",
        )
        FeeItem.objects.create(
            fee_structure=self.structure,
            grade=grade,
            item_code="SENIOR-TUITION",
            item_name="Commerce tuition",
            item_category="TUITION",
            amount=Decimal("1200.00"),
            payment_frequency="ANNUAL",
            stream="COMMERCE",
        )

        base_payload = {
            "school_ids": [str(self.school.pk)],
            "grade_id": str(grade.pk),
            "school_type_id": str(self.school_type.pk),
            "academic_year_id": str(self.year.pk),
        }
        missing_stream_response = self.client.post(
            "/api/fees/estimate/",
            base_payload,
            content_type="application/json",
        )
        self.assertEqual(missing_stream_response.status_code, 400)

        response = self.client.post(
            "/api/fees/estimate/",
            {**base_payload, "stream": "SCIENCE"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        estimate = response.data["results"][0]
        stream_fees = {
            item["item_name"]: item
            for item in estimate["items"]
            if item.get("stream")
        }
        self.assertEqual(set(stream_fees), {"Science tuition"})
        self.assertEqual(stream_fees["Science tuition"]["stream"], "SCIENCE")
        self.assertEqual(
            stream_fees["Science tuition"]["annualized_amount"],
            "1000.00",
        )
