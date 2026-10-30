import pytest

from jobinsights.descriptions import (
    compress,
    decompress,
    description_hash,
    html_to_text,
    normalize_text,
)


@pytest.mark.parametrize(
    ("html", "expected"),
    [
        ("<p>Hello <b>world</b></p>", "Hello world"),
        ("<p>One</p><p>Two</p>", "One\n\nTwo"),
        ("<h2>About</h2><p>We build things.</p>", "About\n\nWe build things."),
        ("<ul>\n  <li>Python</li>\n  <li>SQL</li>\n</ul>", "Python\nSQL"),
        ("<p>Intro</p><ul><li>a</li><li>b</li></ul><p>Outro</p>", "Intro\n\na\nb\n\nOutro"),
        ("<p>Line one<br>Line two</p>", "Line one\nLine two"),
        ("<p>Para one<br><br>Para two</p>", "Para one\n\nPara two"),
        ("<div>a</div><div>b</div>", "a\nb"),
        (
            "<table><tr><td>Pay</td><td>$100k</td></tr><tr><td>Remote</td></tr></table>",
            "Pay $100k\nRemote",
        ),
        ("<p>Source\n   newlines   are\twhitespace</p>", "Source newlines are whitespace"),
        ("<p><b>Bold</b> <i>italic</i></p>", "Bold italic"),
        ("plain text, no tags", "plain text, no tags"),
        ("", ""),
    ],
)
def test_html_to_text(html: str, expected: str) -> None:
    assert html_to_text(html) == expected


def test_scripts_styles_and_comments_are_dropped() -> None:
    html = "<style>p { color: red }</style><p>Hi<!-- note --></p><script>alert(1)</script>"

    assert html_to_text(html) == "Hi"


def test_entities_are_decoded() -> None:
    assert html_to_text("<p>R&amp;D &lt;3 &nbsp;caf&eacute;</p>") == "R&D <3 café"


def test_escaped_html_is_left_as_text() -> None:
    # Unescaping Greenhouse's entity-encoded content is the adapter's job.
    assert html_to_text("&lt;p&gt;Hi&lt;/p&gt;") == "<p>Hi</p>"


def test_deeply_nested_html_does_not_hit_recursion_limit() -> None:
    html = "<div>" * 5000 + "deep" + "</div>" * 5000

    assert html_to_text(html) == "deep"


def test_formatting_only_differences_hash_the_same() -> None:
    compact = "<h2>Role</h2><p>Build <b>APIs</b>.</p><ul><li>Go</li><li>SQL</li></ul>"
    pretty = """
        <h2>  Role </h2>
        <p>
          Build <strong>APIs</strong>.
        </p>
        <ul>
          <li>Go</li>
          <li>SQL</li>
        </ul>
    """

    assert description_hash(html_to_text(compact)) == description_hash(html_to_text(pretty))


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("  a  \r\n b\t c  ", "a\nb c"),
        ("a\n\n\n\n\nb", "a\n\nb"),
        ("a\n \n\t\nb", "a\n\nb"),
        ("cafe\u0301", "café"),  # combining accent → NFC
        ("zero\u200bwidth\ufeff", "zerowidth"),
        ("non\u00a0breaking", "non breaking"),
    ],
)
def test_normalize_text(text: str, expected: str) -> None:
    assert normalize_text(text) == expected


def test_normalize_text_is_idempotent() -> None:
    once = normalize_text("  Messy \r\n\n\n\n text\u200b ")

    assert normalize_text(once) == once


def test_hash_is_sha256_hex_and_content_sensitive() -> None:
    digest = description_hash("Build APIs.")

    assert len(digest) == 64
    assert digest == description_hash("Build APIs.")
    assert digest != description_hash("Build APIs!")


def test_compress_round_trips() -> None:
    text = "Ünïcödé job description — 日本語 ✓\n\n" * 200

    blob = compress(text)

    assert decompress(blob) == text
    assert len(blob) < len(text.encode("utf-8")) / 10
