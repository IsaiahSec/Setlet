from src.services.note_parser import parse_note


def test_parse_note_basic_separators_markers_and_duplicates():
    body = """

    Term: Definition
    Term - Definition
    - Bullet: Value
    * Star – Meaning
    • Bullet point — Result
    1. One: First
    2) Two: Second
    Separate - Value
    Term: Definition
    """

    assert parse_note(body) == [
        {"front": "Term", "back": "Definition"},
        {"front": "Bullet", "back": "Value"},
        {"front": "Star", "back": "Meaning"},
        {"front": "Bullet point", "back": "Result"},
        {"front": "One", "back": "First"},
        {"front": "Two", "back": "Second"},
        {"front": "Separate", "back": "Value"},
    ]


def test_parse_note_uses_first_separator_and_skips_invalid_lines():
    body = (
        "Colon: Definition: with more detail\n"
        "Colon before - dash: definition\n"
        "Dash - before: colon\n"
        "state-of-the-art\n"
        "No separator here\n"
        ": Empty front\n"
        "Empty back:\n"
        "Front – \n"
        "\n"
    )

    assert parse_note(body) == [
        {"front": "Colon", "back": "Definition: with more detail"},
        {"front": "Colon before", "back": "dash: definition"},
        {"front": "Dash", "back": "before: colon"},
    ]


def test_parse_note_skips_overlong_fields_and_duplicates():
    body = "\n".join(
        [
            "Front: " + "b" * 2000,
            "x" * 2001 + ": Back",
            "Duplicate: Pair",
            "Duplicate: Pair",
            "Unique — " + "y" * 2000,
        ]
    )

    assert parse_note(body) == [
        {"front": "Front", "back": "b" * 2000},
        {"front": "Duplicate", "back": "Pair"},
        {"front": "Unique", "back": "y" * 2000},
    ]


def test_parse_note_caps_output_at_200():
    body = "\n".join(f"Term {index}: Definition {index}" for index in range(250))

    cards = parse_note(body)

    assert len(cards) == 200
    assert cards[0] == {"front": "Term 0", "back": "Definition 0"}
    assert cards[-1] == {"front": "Term 199", "back": "Definition 199"}


def test_parse_note_returns_empty_for_non_string_body():
    assert parse_note(None) == []
