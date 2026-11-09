"""Profile completion for one school, using records that already exist.

Missing information stays "missing". It is never stored as "not available".
A filled field is published only after the school itself is verified.
"""
from __future__ import annotations


def _filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _offers_boarding(school) -> bool:
    for school_type in school.school_types.all():
        if "BOARD" in (school_type.type_code or "").upper():
            return True
    return False


def _status(filled: bool, verification: str, required: bool = True) -> str:
    if not filled:
        return "missing" if required else "optional"
    if verification == "VERIFIED":
        return "published"
    if verification == "PENDING":
        return "awaiting_approval"
    return "needs_correction"


def _item(key, label, filled, verification, detail, required=True):
    return {
        "key": key,
        "label": label,
        "status": _status(filled, verification, required),
        "detail": detail,
    }


def _section(key, label, items):
    required = [item for item in items if item["status"] != "optional"]
    filled = [item for item in required if item["status"] != "missing"]
    score = round(len(filled) / len(required) * 100) if required else 100
    if any(item["status"] == "missing" for item in required):
        status = "missing"
    elif any(item["status"] == "needs_correction" for item in required):
        status = "needs_correction"
    elif any(item["status"] == "awaiting_approval" for item in required):
        status = "awaiting_approval"
    else:
        status = "published"
    return {
        "key": key,
        "label": label,
        "score": score,
        "status": status,
        "items": items,
    }


def build_profile_completion(school) -> dict:
    verification = school.verification_status or "UNVERIFIED"
    facilities = list(school.school_facilities.all())
    categories = {
        (row.facility.category or "").upper()
        for row in facilities
        if row.available and row.facility_id
    }
    grades = [row for row in school.school_grades.all() if row.is_active]
    photos = [row for row in school.photos.all() if row.status]
    structures = list(school.fee_structures.all())
    published_fees = [row for row in structures if row.status and row.published]
    fee_items = [item for row in structures for item in row.fee_items.all()]
    priced_items = [item for item in fee_items if item.amount is not None]
    boarding = _offers_boarding(school)
    has_contact = _filled(school.phone) or _filled(school.email)

    sections = [
        _section(
            "basic",
            "Basic information",
            [
                _item("tagline", "Tagline", _filled(school.tagline), verification, "A one-line summary parents see in search."),
                _item("about", "School description", _filled(school.about), verification, "Describe the school in a few paragraphs."),
                _item("established_year", "Year established", _filled(school.established_year), verification, "The year the school was founded."),
                _item("gender", "Gender classification", _filled(school.gender), verification, "Co-ed, boys, or girls."),
                _item("school_types", "School type", school.school_types.exists(), verification, "Day, day boarding, or boarding."),
            ],
        ),
        _section(
            "contact",
            "Contact information",
            [
                _item("phone", "Phone number", _filled(school.phone), verification, "Official phone, with country code."),
                _item("email", "Email address", _filled(school.email), verification, "Official email parents can write to."),
                _item("website", "Website", _filled(school.website), verification, "The school's own website.", required=False),
                _item("principal_name", "Principal", _filled(school.principal_name), verification, "Name of the principal or head.", required=False),
                _item("address", "Address", _filled(school.address), verification, "Street address shown on the profile."),
                _item("reachable", "At least one contact method", has_contact, verification, "Parents need a phone number or an email address."),
            ],
        ),
        _section(
            "location",
            "Location",
            [
                _item("city", "City", school.city_id is not None, verification, "City is required on every school."),
                _item("state", "State", school.state_id is not None, verification, "State is required on every school."),
                _item("locality", "Locality", school.location_id is not None, verification, "Neighbourhood or locality inside the city."),
                _item("pincode", "Postal code", _filled(school.pincode), verification, "PIN code or postal code."),
                _item("map", "Map coordinates", school.lat is not None and school.lng is not None, verification, "Latitude and longitude for the map.", required=False),
            ],
        ),
        _section(
            "academics",
            "Academics",
            [
                _item("boards", "Education board", school.boards.exists(), verification, "CBSE, ICSE, IB, or another board."),
                _item("grades", "Grades offered", bool(grades), verification, "Classes the school currently admits."),
            ],
        ),
        _section(
            "fees",
            "Fees and admissions",
            [
                _item("fee_structure", "Fee structure", bool(structures), verification, "A fee structure for an academic year."),
                _item("fee_amounts", "Fee amounts", bool(priced_items), verification, "At least one fee with an amount."),
                _item(
                    "fee_published",
                    "Fees visible to parents",
                    bool(published_fees),
                    verification,
                    "Publish the fee structure when the amounts are ready for the public profile.",
                ),
            ],
        ),
        _section(
            "campus",
            "Classrooms and laboratories",
            [
                _item("academic", "Academic facilities", "ACADEMIC" in categories, verification, "Classrooms, laboratories, or other academic spaces."),
            ],
        ),
        _section(
            "sports",
            "Sports",
            [
                _item("sports", "Sports facilities", "SPORTS" in categories, verification, "Grounds, courts, or indoor sports the school offers."),
            ],
        ),
        _section(
            "hostel",
            "Hostel and accommodation",
            [
                _item(
                    "hostel",
                    "Hostel or accommodation",
                    "ACCOMMODATION" in categories,
                    verification,
                    "Required for boarding and day-boarding schools. Record capacity in the facility quantity.",
                    required=boarding,
                ),
            ],
        ),
        _section(
            "dining",
            "Dining",
            [
                _item("dining", "Dining arrangement", "DINING" in categories, verification, "Mess, cafeteria, or meal service.", required=boarding),
            ],
        ),
        _section(
            "healthcare",
            "Healthcare",
            [
                _item("health", "Healthcare", "HEALTH" in categories, verification, "Medical room, nurse, or doctor availability.", required=boarding),
            ],
        ),
        _section(
            "safety",
            "Safety",
            [
                _item("safety", "Safety and security", "SAFETY" in categories, verification, "Campus safety facilities parents should know about. Do not publish internal security procedures."),
            ],
        ),
        _section(
            "transport",
            "Transport",
            [
                _item("transport", "Transport", "TRANSPORT" in categories, verification, "School transport, if the school offers it.", required=False),
            ],
        ),
        _section(
            "gallery",
            "Photographs",
            [
                _item("logo", "School logo", _filled(school.school_logo_url), verification, "Square logo used in search and on the profile."),
                _item("cover", "Cover photograph", _filled(school.school_image_url), verification, "The main campus photograph."),
                _item("gallery", "Gallery photographs", bool(photos), verification, "More photographs of campus, classrooms, sports, or hostel."),
            ],
        ),
        _section(
            "publishing",
            "Verification",
            [
                {
                    "key": "verification",
                    "label": "BoardingEdu approval",
                    "status": {
                        "VERIFIED": "published",
                        "PENDING": "awaiting_approval",
                    }.get(verification, "needs_correction"),
                    "detail": {
                        "VERIFIED": "This school is approved and can appear in public search.",
                        "PENDING": "Submitted for review. BoardingEdu still has to approve it.",
                        "UNVERIFIED": "Not approved yet. Complete the missing sections, then wait for review.",
                    }.get(verification, "Not approved yet."),
                }
            ],
        ),
    ]

    required_items = [
        item
        for section in sections
        if section["key"] != "publishing"
        for item in section["items"]
        if item["status"] != "optional"
    ]
    complete_items = [item for item in required_items if item["status"] != "missing"]
    score = round(len(complete_items) / len(required_items) * 100) if required_items else 0
    summary = {"missing": 0, "awaiting_approval": 0, "needs_correction": 0, "published": 0}
    for item in required_items:
        summary[item["status"]] = summary.get(item["status"], 0) + 1

    return {
        "score": score,
        "summary": summary,
        "sections": sections,
    }
