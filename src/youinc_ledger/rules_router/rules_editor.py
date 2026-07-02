"""Comment-preserving textual edits to ``rules.yaml``.

The frontend used to hand-edit this file; that logic now lives here so the
Python CLI owns every write. We edit the YAML textually (rather than a PyYAML
round-trip) so the curated comments in ``rules.yaml`` survive each change.
"""

from __future__ import annotations

import re
from pathlib import Path

MANUAL_RULE_PRIORITY = 500


def slugify(text: str, *, max_length: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    slug = slug[:max_length].strip("_")
    return slug or "txn"


def derive_description_pattern(description: str) -> str:
    """Case-insensitive regex that matches this exact description string."""
    return f"(?i){re.escape(description.strip())}"


def _yaml_single_quote(value: str) -> str:
    """Render ``value`` as a YAML single-quoted scalar (backslashes stay literal)."""
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def _section_bounds(lines: list[str], key: str) -> tuple[int, int] | None:
    """Return (start, end) line indices for a top-level ``key:`` block."""
    start = next(
        (i for i, line in enumerate(lines) if re.match(rf"^{re.escape(key)}:\s*$", line)),
        None,
    )
    if start is None:
        return None
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if re.match(r"^\S", lines[index]) and lines[index].strip():
            end = index
            break
    return start, end


def _existing_rule_ids(lines: list[str]) -> set[str]:
    return {
        match.group(1)
        for match in (re.match(r"^\s*-\s*id:\s*(\S+)\s*$", line) for line in lines)
        if match
    }


def _unique_rule_id(lines: list[str], base: str) -> str:
    existing = _existing_rule_ids(lines)
    candidate = base
    suffix = 2
    while candidate in existing:
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate


def append_classification_rule(
    rules_path: str | Path,
    *,
    description: str,
    target_account: str,
    pattern: str | None = None,
    memo: str | None = None,
    priority: int = MANUAL_RULE_PRIORITY,
) -> tuple[str, str]:
    """Append a description-regex rule to ``rules.yaml``.

    Returns ``(rule_id, pattern)``.
    """
    path = Path(rules_path)
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = text.splitlines()

    resolved_pattern = pattern or derive_description_pattern(description)
    rule_id = _unique_rule_id(lines, f"manual_{slugify(description)}")

    block = [
        f"  - id: {rule_id}",
        f"    priority: {priority}",
        "    match:",
        f"      description_regex: {_yaml_single_quote(resolved_pattern)}",
        "    route:",
        f"      target_account: {target_account}",
    ]
    if memo:
        block.append(f"      memo: {_yaml_single_quote(memo)}")

    bounds = _section_bounds(lines, "rules")
    if bounds is None:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append("rules:")
        lines.extend(block)
    else:
        _, end = bounds
        insert_at = end
        while insert_at - 1 > bounds[0] and lines[insert_at - 1].strip() == "":
            insert_at -= 1
        lines[insert_at:insert_at] = block

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return rule_id, resolved_pattern


def _yaml_mapping_key(key: str) -> str:
    return key if re.match(r"^[A-Za-z0-9_.-]+$", key) else _yaml_single_quote(key)


def upsert_account_mapping(
    rules_path: str | Path,
    *,
    account_id: str,
    ledger_account: str,
    account_type: str,
    credit_limit_cents: int | None = None,
) -> None:
    """Insert or replace an entry under ``account_mappings`` in ``rules.yaml``."""
    path = Path(rules_path)
    default_header = (
        "defaults:\n  currency: NZD\n  suspense_account: Expenses:Uncategorized:Suspense\n"
    )
    text = path.read_text(encoding="utf-8") if path.exists() else default_header
    lines = text.rstrip("\n").splitlines()

    block = [
        f"  {_yaml_mapping_key(account_id)}:",
        f"    ledger_account: {ledger_account}",
        f"    account_type: {account_type}",
    ]
    if credit_limit_cents is not None:
        block.append(f"    credit_limit_cents: {credit_limit_cents}")

    bounds = _section_bounds(lines, "account_mappings")
    if bounds is None:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append("account_mappings:")
        lines.extend(block)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    start, end = bounds
    entry_start = -1
    entry_end = end
    for index in range(start + 1, end):
        match = re.match(r"^  ([^:]+|'(?:[^']|'')+'|\"[^\"]+\"):\s*$", lines[index])
        if not match or _parse_yaml_key(match.group(1)) != account_id:
            continue
        entry_start = index
        for nxt in range(index + 1, end):
            if re.match(r"^  \S", lines[nxt]):
                entry_end = nxt
                break
        break

    if entry_start == -1:
        lines[end:end] = block
    else:
        lines[entry_start:entry_end] = block

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _parse_yaml_key(key: str) -> str:
    trimmed = key.strip()
    if trimmed.startswith("'") and trimmed.endswith("'"):
        return trimmed[1:-1].replace("''", "'")
    if trimmed.startswith('"') and trimmed.endswith('"'):
        return trimmed[1:-1]
    return trimmed
