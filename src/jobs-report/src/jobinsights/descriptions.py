"""Job descriptions: HTML → plain text, a stable hash, and zlib compression.

Descriptions are stored once per unique normalized text (PLAN.md §2), so the
normalization here decides when two descriptions count as the same. Everything
in this module is a pure function.

`html_to_text` expects real HTML. Sources that send entity-escaped HTML
(Greenhouse's `&lt;p&gt;`) are unescaped by their adapter first.
"""

import hashlib
import re
import unicodedata
import zlib

from selectolax.lexbor import LexborHTMLParser, LexborNode

# Tags dropped together with their content.
_DROPPED_TAGS = ["script", "style", "noscript", "template", "head"]
# Elements that start and end a paragraph (blank line around them).
_PARAGRAPH_TAGS = frozenset(
    {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "dl", "table", "blockquote", "pre"}
    | {"section", "article", "header", "footer", "aside", "nav", "figure", "hr"}
)
# Elements that start and end a line.
_LINE_TAGS = frozenset({"div", "li", "tr", "dt", "dd", "caption", "figcaption", "address"})
# Table cells are separated by a space within their row.
_CELL_TAGS = frozenset({"td", "th"})
_CELL_END = " "

_WHITESPACE = re.compile(r"\s+")
_SPACES_IN_LINE = re.compile(r"[^\S\n]+")
_EXTRA_BLANK_LINES = re.compile(r"\n{3,}")
_INVISIBLE = re.compile("[\u200b\ufeff]")  # zero-width space, byte-order mark


def html_to_text(html: str) -> str:
    """Convert an HTML description to normalized plain text.

    Line breaks come only from the document structure: paragraphs and headings
    are separated by a blank line, list items and `<br>` by a line break. A
    `<p>` directly inside an `<li>` counts as a line, not a paragraph.
    Whitespace inside text collapses to single spaces, as a browser renders it.
    """
    tree = LexborHTMLParser(html)
    tree.strip_tags(_DROPPED_TAGS)
    if tree.body is None:
        return ""

    out: list[str] = []
    pending_breaks = 0  # newlines owed before the next text

    # Iterative depth-first walk, so deeply nested HTML can't hit the recursion
    # limit. Besides nodes, the stack holds what's owed when an element ends:
    # an int is a number of line breaks, _CELL_END is a separating space.
    stack: list[LexborNode | int | str] = [tree.body]
    while stack:
        item = stack.pop()
        if isinstance(item, int):
            pending_breaks = max(pending_breaks, item)
            continue
        if isinstance(item, str):
            out.append(item)
            continue
        if item.is_text_node:
            text = _WHITESPACE.sub(" ", item.text_content or "")
            if text == " " and (pending_breaks or not out):
                continue  # whitespace between blocks
            if pending_breaks and out:
                out.append("\n" * pending_breaks)
            pending_breaks = 0
            out.append(text)
            continue

        tag = item.tag
        if tag == "br":
            pending_breaks = min(pending_breaks + 1, 2)
            continue
        if tag in _PARAGRAPH_TAGS or tag in _LINE_TAGS:
            breaks = 2 if tag in _PARAGRAPH_TAGS and not _is_list_item_paragraph(item) else 1
            pending_breaks = max(pending_breaks, breaks)
            stack.append(breaks)
        elif tag in _CELL_TAGS:
            stack.append(_CELL_END)
        stack.extend(reversed(list(item.iter(include_text=True))))

    return normalize_text("".join(out))


def _is_list_item_paragraph(node: LexborNode) -> bool:
    # Editors often wrap each <li> in a <p>; render those as lines, not paragraphs.
    return node.tag == "p" and node.parent is not None and node.parent.tag == "li"


def normalize_text(text: str) -> str:
    """Normalize plain text so formatting-only differences hash the same.

    NFC, no zero-width characters, `\\n` line endings, single spaces within a
    line, trimmed lines, at most one blank line in a row, trimmed ends.
    """
    text = unicodedata.normalize("NFC", text)
    text = _INVISIBLE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = (_SPACES_IN_LINE.sub(" ", line).strip() for line in text.split("\n"))
    return _EXTRA_BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()


def description_hash(text: str) -> str:
    """sha256 hex digest of already-normalized text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compress(text: str) -> bytes:
    return zlib.compress(text.encode("utf-8"), level=9)


def decompress(blob: bytes) -> str:
    return zlib.decompress(blob).decode("utf-8")
