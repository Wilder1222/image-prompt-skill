# Silver Character v0.7.4 Regression Plan

Observed from v0.7.3 test:
- environment suppression: pass
- identity family: pass
- full-body completion: pass
- human presence: partial
- silhouette/density growth: mild
- initial hand anatomy: fail, later local patch succeeded

Recommended:
- render mode: style_asset
- fidelity: silver_asset_case
- completion budget: C1
- density budget: preserve
- wear: W0
- human presence: H2 v2
- extremity: E2

Prompt compiler emphasis:
1. keep the visible upper-body design and material family;
2. extend lower body conservatively, with no new primary motifs and no extra embroidery density;
3. preserve the calm silver-haired identity;
4. humanize eyes, soft tissue, regional skin and camera response;
5. visibly inspect both hands after generation.
