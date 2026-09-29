# Gemini Image — Facial Trait Calibration v0.7.1

Gemini image models support multiple references and explicit character-consistency workflows. For a single character maturity edit, use fewer references than the maximum whenever possible to reduce role ambiguity.

Recommended:

- Image 1 = identity / Asset Master
- Image 2 = trait-only maturity reference
- describe exactly which traits from Image 2 are allowed
- state that Image 1 facial geometry remains authoritative

Do not turn a high reference count into a quality goal. Character consistency is easier to audit when each image has one job.
