# Human Presence v3.1 Pipeline

```text
P9 accepted
→ human_face_optical_refine
→ diagnose / lock
→ human_camera_hair_refine
→ diagnose / lock
→ studio_polish
→ upscale
```

若身份或 P9 失败，先回对应上游 Round；不得用 H2.7 覆盖身份或比例失败。
