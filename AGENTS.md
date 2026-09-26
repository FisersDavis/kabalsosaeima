\### Terminal Execution Constraints

\- NEVER run inline multi-line scripts using `py -c "..."` or `node -e "..."`.

\- Always write inspection, parsing, or test scripts into `scripts/` (e.g., `scripts/temp\_check.py`) and execute the script path (`py scripts/temp\_check.py`).

\- Keep all terminal invocations single-line and atomic.

