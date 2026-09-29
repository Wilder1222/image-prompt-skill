# FLUX.2 — Style Restoration Adapter

FLUX.2 documentation emphasizes subject-first prompt order and notes that word order matters. It supports multi-reference editing.

For hybrid restoration:
1. Put the asset character / identity first.
2. Put the critical style restoration language next.
3. Add environment and lighting.
4. Add secondary material detail last.

FLUX.2 does not use negative prompts; translate exclusions into positive target descriptions.

Example conversion:
- “do not become flat studio lighting” → “cinematic directional key, weaker fill, luminous separation light, atmospheric depth”
- “do not lose painterly mood” → “retain painterly-cinematic atmosphere, luminous layered depth and expressive motion language”
