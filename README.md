# Freelancer Toolbox

A small, static GitHub Pages site that bundles a few practical calculators I use in real-world freelancing / B2B conversations.

## Included tools

- **Hourly Rate Calculator** (`tools/hourly-rate/`)
  - Derives an hourly (or day) rate from annual cost structure, unproductive days, and a configurable tax model.
  - Includes JSON presets + import/export.

- **Retainer Tier Evaluator** (`tools/retainer-tier/`)
  - Compares retainer tiers by MRR/ARR, effective rate, reserved capacity, and contract knobs (discount, overage, notice, term).

- **Replacement Cost Calculator** (`tools/replacement-cost/`)
  - Estimates the replacement premium (Δ vs baseline) based on ramp-up productivity, mentoring overhead, procurement hours, and optional cost-of-delay.
  - Includes JSON presets + import/export.

## Run locally

No build step. Any static server works.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes / disclaimer

These tools are for modeling and decision support. They are **not** tax/legal advice and they may use simplified assumptions.

## Adding a new tool

1. Create a new folder under `tools/<your-tool>/`.
2. Add a `tool.json` file inside that folder (required keys: `title`, `description`; optional: `tags`, `order`).
3. Run `make tools-json` to regenerate `tools.json`.
4. Commit your changes.

On GitHub, a workflow regenerates `tools.json` on pushes to `main` (and verifies it on pull requests).
