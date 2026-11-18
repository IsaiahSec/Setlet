import re


CARD_FIELD_MAX_LENGTH = 2000
DASH_SEPARATORS = (" - ", " – ", " — ")
LEADING_LIST_MARKER = re.compile(r"^(?:[-*•]|\d+[.)])\s*")


def parse_note(body):
    """Turn note text into deduplicated candidate flashcards."""
    if not isinstance(body, str):
        return []

    cards = []
    seen = set()

    for raw_line in body.splitlines():
        line = LEADING_LIST_MARKER.sub("", raw_line.strip(), count=1).strip()
        if not line:
            continue

        colon_index = line.find(":")
        separator_index = colon_index
        separator_length = 1 if colon_index >= 0 else 0

        for separator in DASH_SEPARATORS:
            dash_index = line.find(separator)
            if dash_index >= 0 and (
                separator_index < 0 or dash_index < separator_index
            ):
                separator_index = dash_index
                separator_length = len(separator)

        if separator_index < 0:
            continue

        front = line[:separator_index].strip()
        back = line[separator_index + separator_length :].strip()
        if not front or not back:
            continue
        if (
            len(front) > CARD_FIELD_MAX_LENGTH
            or len(back) > CARD_FIELD_MAX_LENGTH
            or "\x00" in front
            or "\x00" in back
        ):
            continue

        pair = (front, back)
        if pair in seen:
            continue
        seen.add(pair)
        cards.append({"front": front, "back": back})
        if len(cards) == 200:
            break

    return cards
