# Execution Guidelines

- Do not run inline code via shell flags (never use `py -c "..."` or `node -e "..."`).
- Always write inspection, testing, or migration scripts into a dedicated file under `scripts/` (e.g., `scripts/temp_check.py`).
- Run scripts directly by file path: `py scripts/temp_check.py` or `node scripts/temp_check.js`.
- Keep git operations atomic and single-line.