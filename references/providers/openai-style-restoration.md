# OpenAI GPT Image — Style Restoration Adapter

Official image prompting guidance recommends assigning roles to references, separating changes from constraints, and refining one change at a time.

For hybrid restoration:

1. Identify the Style Restoration Reference and Asset Master explicitly.
2. State asset locks before style channels.
3. Say which style channels may transfer: mood, lighting, motion, atmosphere, medium.
4. State which structural channels may not transfer: face, body, garment architecture.
5. Apply Reality Gain R-level after continuity is established.

Recommended structure:
- Reference roles
- Primary goal
- Preserve list
- Style restoration channels
- Reality/material/lighting upgrades
- Final visual target

Do not rely on “same style as image A” alone when identity preservation matters.
