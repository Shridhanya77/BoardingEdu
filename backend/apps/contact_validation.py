import re

from rest_framework import serializers


def normalize_phone_number(value: str) -> str:
    if not re.fullmatch(r"\+?[0-9\s().-]+", value.strip()):
        raise serializers.ValidationError("Enter a valid phone number.")

    digits = re.sub(r"\D", "", value)
    if not 11 <= len(digits) <= 13 or digits.startswith("0"):
        raise serializers.ValidationError(
            "Enter a country code followed by exactly 10 phone number digits."
        )
    return digits
