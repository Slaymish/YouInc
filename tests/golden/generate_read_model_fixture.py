"""Generate ``fixtures/read_model.json`` — the read-DAL golden fixture.

Reuses the exact ``input`` blocks (payloads + manual classifications) from
``journal_balancing.json`` so the read-model corpus replays the same
transactions the write-side pipeline fixture already pins, and captures the four
read-DAL surfaces per case via :func:`read_model_support.capture_read_model`.

Run from the repo root:

    .venv/bin/python tests/golden/generate_read_model_fixture.py

Idempotent: re-running against an unchanged engine + rules snapshot rewrites an
identical file. Commit the result; the TS port consumes it verbatim.
"""
from __future__ import annotations

import json
from pathlib import Path

from read_model_support import FIXTURES, capture_read_model

SOURCE_FIXTURE = FIXTURES / "journal_balancing.json"
OUTPUT_FIXTURE = FIXTURES / "read_model.json"


def build_cases() -> list[dict]:
    source = json.loads(SOURCE_FIXTURE.read_text(encoding="utf-8"))
    cases: list[dict] = []
    for case in source["cases"]:
        cases.append(
            {
                "case_id": case["case_id"],
                "source": case["source"],
                "note": case.get("note", ""),
                "input": case["input"],
                "expected": capture_read_model(case["input"]),
            }
        )
    return cases


def main() -> None:
    payload = {"cases": build_cases()}
    OUTPUT_FIXTURE.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(payload['cases'])} cases -> {OUTPUT_FIXTURE}")


if __name__ == "__main__":
    main()
