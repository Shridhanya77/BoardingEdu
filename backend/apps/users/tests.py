from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from .serializers import UserRegisterSerializer


class UserRegistrationContactValidationTests(SimpleTestCase):
    def test_phone_requires_country_code_and_exactly_ten_digits(self):
        serializer = UserRegisterSerializer()

        self.assertEqual(
            serializer.fields["phone"].run_validation("+91 98765 43210"),
            "+91 98765 43210",
        )
        with self.assertRaises(ValidationError):
            serializer.validate_phone("9876543210")

        with self.assertRaises(ValidationError):
            serializer.validate_phone("+91 98765 4321099")

        self.assertEqual(
            serializer.validate_phone("+91 98765 43210"),
            "919876543210",
        )
