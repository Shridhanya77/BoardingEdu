"""Search phrases a school profile can honestly answer.

Each phrase is a distinct query a parent might type — school name, admissions,
fees, board, or place — and duplicates are dropped. The list is meant for the
page metadata and for links into the directory, not for repeating the same
words in the visible copy.
"""


def _clean(value):
    return " ".join(str(value or "").split()).strip()


def school_seo_keywords(school, limit=12):
    name = _clean(getattr(school, "school_name", ""))
    city = _clean(getattr(getattr(school, "city", None), "city_name", ""))
    state = _clean(getattr(getattr(school, "state", None), "state_name", ""))
    locality = _clean(getattr(getattr(school, "location", None), "location_name", ""))
    types = [_clean(item.type_name) for item in school.school_types.all()]
    types = [item for item in types if item]
    boards = [_clean(item.board_name) for item in school.boards.all()]
    boards = [item for item in boards if item]
    gender = _clean(school.get_gender_display()) if hasattr(school, "get_gender_display") else ""

    phrases = []
    if name:
        phrases.append(name)
        phrases.append(f"{name} admissions")
        phrases.append(f"{name} fees")
        phrases.append(f"{name} reviews")
    if name and city and city.lower() not in name.lower():
        phrases.append(f"{name} {city}")
    if city:
        phrases.append(f"school admissions in {city}")
        phrases.append(f"schools in {city}")
    if locality and city:
        phrases.append(f"schools in {locality}, {city}")
    elif locality:
        phrases.append(f"schools in {locality}")
    for board in boards[:2]:
        if city:
            phrases.append(f"{board} schools in {city}")
        elif state:
            phrases.append(f"{board} schools in {state}")
        phrases.append(f"{name} {board}".strip())
    if boards and state and city:
        phrases.append(f"{boards[0]} schools in {state}")
    for school_type in types[:2]:
        place = city or state
        if place:
            phrases.append(f"{school_type} in {place}")
        else:
            phrases.append(school_type)
    if gender and city and gender.lower() not in {"co-ed", "coed"}:
        phrases.append(f"{gender} schools in {city}")
    if city and state:
        phrases.append(f"schools in {city}, {state}")

    seen = set()
    ordered = []
    for phrase in phrases:
        clean = _clean(phrase)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        ordered.append(clean)
        if len(ordered) >= limit:
            break
    return ordered
