import re

from rest_framework import serializers

PHONE_COUNTRY_DIAL_CODES = (
    "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41",
    "43", "44", "45", "47", "48", "49", "51", "52", "54", "55", "56", "57", "60",
    "61", "62", "63", "65", "66", "81", "82", "86", "90", "91", "92", "971",
    "880", "213", "233", "234", "380",
)


def normalize_phone_number(value: str) -> str:
    trimmed = value.strip()
    if not re.fullmatch(r"\+?[1-9][0-9\s().-]+", trimmed):
        raise serializers.ValidationError("Enter a valid phone number.")

    digits = re.sub(r"\D", "", trimmed)
    dial_code = next(
        (
            code
            for code in sorted(PHONE_COUNTRY_DIAL_CODES, key=len, reverse=True)
            if digits.startswith(code) and len(digits) - len(code) == 10
        ),
        None,
    )
    if dial_code is None:
        raise serializers.ValidationError(
            "Enter a country code followed by exactly 10 phone number digits."
        )
    return digits
