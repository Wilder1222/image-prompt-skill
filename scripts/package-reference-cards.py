"""Package an actually generated four-panel board; never edit an original."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def gutter(rgb, start, end):
    height, width, _ = rgb.shape
    occupied = np.count_nonzero(np.min(rgb, axis=2) < 238, axis=0)
    empty = occupied <= max(1, int(height * 0.004))
    lo, hi = int(start * width), int(end * width)
    runs, begin = [], None
    for x in range(lo, hi):
        if empty[x] and begin is None:
            begin = x
        if begin is not None and (not empty[x] or x == hi - 1):
            finish = x if not empty[x] else x + 1
            runs.append((finish - begin, begin, finish))
            begin = None
    if not runs:
        raise ValueError("No clear white gutter; inspect the board, do not crop through figures")
    length, begin, finish = max(runs)
    if length < max(5, int(width * 0.003)):
        raise ValueError("Gutter is too narrow for automatic packaging")
    return (begin + finish) // 2, [begin, finish]


def package(generation_file):
    generation_file = Path(generation_file).resolve()
    generation = json.loads(generation_file.read_text(encoding="utf-8"))
    board = Path(generation["workspace_output"]).resolve()
    if generation.get("actual_image_generated") is not True or digest(board) != generation["output_sha256"]:
        raise ValueError("Actual generated board receipt/hash required")
    folder, stem = generation_file.parent, generation["stem"]
    with Image.open(board) as original:
        im = original.copy()
        info = original.info.copy()
    rgb = np.asarray(im.convert("RGB"))
    h, w, _ = rgb.shape
    if w < h:
        raise ValueError("Expected landscape four-panel board")
    boundaries, spans = [], []
    for start, end in [(0.20, 0.40), (0.43, 0.65), (0.68, 0.88)]:
        x, span = gutter(rgb, start, end)
        boundaries.append(x)
        spans.append(span)
    if not 0 < boundaries[0] < boundaries[1] < boundaries[2] < w:
        raise ValueError("Invalid panel boundaries")
    boxes = {
        "portrait": (0, 0, boundaries[0], h),
        "full_body": (boundaries[0], 0, boundaries[1], h),
        "three_views": (boundaries[0], 0, w, h),
    }
    cards = []
    for kind, box in boxes.items():
        out = folder / "cards" / f"{stem}-{kind}.png"
        if out.exists():
            raise ValueError(f"Output exists: {out}")
        out.parent.mkdir(parents=True, exist_ok=True)
        cropped = im.crop(box)
        options = {"icc_profile": info["icc_profile"]} if "icc_profile" in info else {}
        cropped.save(out, format="PNG", **options)
        with Image.open(out) as check:
            if check.mode != cropped.mode or not np.array_equal(np.asarray(check), np.asarray(cropped)):
                raise ValueError("Export pixels differ from the actual board region")
        cards.append({"kind": kind, "path": str(out), "sha256": digest(out), "crop_rectangle": list(box),
                      "width": cropped.width, "height": cropped.height, "pixel_exact_crop": True})
    record = {"schema_version": 1, "id": generation["id"], "stem": stem,
              "board_path": str(board), "board_sha256": digest(board), "board_width": w, "board_height": h,
              "method": "python_pixel_exact_board_crops", "model_calls_for_this_board": 1,
              "derived_card_count": 3, "cards": cards, "white_gutter_spans": spans,
              "panels": {"portrait": [0, 0, boundaries[0], h], "front": [boundaries[0], 0, boundaries[1], h],
                         "left_side": [boundaries[1], 0, boundaries[2], h], "back": [boundaries[2], 0, w, h]},
              "original_images_modified": False, "resampled": False, "source_identity_certified": False,
              "visual_review_required": True, "unknown_source_regions": "generated_completion"}
    output = folder / f"{stem}.cards.json"
    with output.open("x", encoding="utf-8") as file:
        json.dump(record, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return {"id": record["id"], "stem": stem, "cards": len(cards), "boundaries": boundaries, "receipt": str(output)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("generation_receipt")
    args = parser.parse_args()
    print(json.dumps(package(args.generation_receipt), ensure_ascii=False))
