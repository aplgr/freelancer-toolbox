#!/usr/bin/env python3

"""Generate tools.json from tools/*/tool.json metadata.

This repository aims to be drop-in extensible: add a new tool folder with a
tool.json and the landing page will pick it up automatically.

No third-party dependencies.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Tool:
    slug: str
    title: str
    description: str
    tags: list[str]
    href: str
    order: int | None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "tags": self.tags,
            "href": self.href,
        }
        if self.order is not None:
            d["order"] = self.order
        return d


def _utc_iso_z() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON in {path}: {e}")


def _load_existing_payload(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _validate_tool_meta(meta: dict[str, Any], meta_path: Path, default_slug: str) -> Tool:
    slug = str(meta.get("slug") or default_slug)
    title = meta.get("title")
    description = meta.get("description")

    if not isinstance(title, str) or not title.strip():
        raise SystemExit(f"Missing required 'title' in {meta_path}")
    if not isinstance(description, str) or not description.strip():
        raise SystemExit(f"Missing required 'description' in {meta_path}")

    tags_raw = meta.get("tags") or []
    if not isinstance(tags_raw, list) or not all(isinstance(t, str) for t in tags_raw):
        raise SystemExit(f"'tags' must be a list of strings in {meta_path}")
    tags = [t.strip() for t in tags_raw if t.strip()]

    order = meta.get("order")
    if order is not None and not isinstance(order, int):
        raise SystemExit(f"'order' must be an integer (or omitted) in {meta_path}")

    return Tool(
        slug=slug,
        title=title.strip(),
        description=description.strip(),
        tags=tags,
        href=f"tools/{slug}/",
        order=order,
    )


def generate(tools_dir: Path, out_path: Path) -> tuple[int, bool]:
    if not tools_dir.exists() or not tools_dir.is_dir():
        raise SystemExit(f"Tools directory not found: {tools_dir}")

    tools: list[Tool] = []
    for entry in sorted(tools_dir.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        meta_path = entry / "tool.json"
        if not meta_path.is_file():
            continue
        meta = _load_json(meta_path)
        tools.append(_validate_tool_meta(meta, meta_path, default_slug=entry.name))

    tools.sort(key=lambda t: ((t.order if t.order is not None else 10_000), t.title.lower()))

    tool_payload = [t.to_dict() for t in tools]
    existing_payload = _load_existing_payload(out_path)

    if existing_payload and existing_payload.get("tools") == tool_payload:
        return len(tools), False

    payload = {
        "generatedAt": _utc_iso_z(),
        "tools": tool_payload,
    }

    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp_path, out_path)

    return len(tools), True


def main(argv: list[str]) -> int:
    script_dir = Path(__file__).resolve().parent
    root = script_dir.parent
    tools_dir = root / "tools"
    out_path = root / "tools.json"

    count, changed = generate(tools_dir, out_path)
    if changed:
        print(f"Wrote {out_path} ({count} tools)")
    else:
        print(f"{out_path} is up to date ({count} tools)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
