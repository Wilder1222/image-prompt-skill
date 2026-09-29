# OpenAI v0.7.4 Constraint Budget Compiler

For iterative image edits, keep the prompt natural-language and scope-limited.

- Translate C1/Density/Wear budgets into explicit visible constraints, not pseudo-parameters.
- When a hand/finger error is the only failure, use the current result as the direct edit target and describe only the anatomical correction plus locks.
- H2 v2 should prioritize facial soft tissue, eye anatomy, regional skin response, hair grouping, and camera response. Do not repeat the full costume description if it is already locked by the current image.
- If a completed lower body is overdesigned, repair the extension rather than regenerating the whole character.
