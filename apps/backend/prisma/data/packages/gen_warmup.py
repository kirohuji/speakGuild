"""Warmup pipeline - no duplicate prompts, target words from vocab only."""

import csv
import json
import os

BASE = r"C:\Users\z1309\Desktop\work\speakGuild\apps\backend\prisma"
PKD = os.path.join(BASE, "data", "packages")
PKGS = {
    1: "foundation-1-beginner",
    2: "foundation-2-daily-life",
    3: "foundation-3-daily-work",
    4: "foundation-4-essential-phrases",
    5: "foundation-5-opinion-basics",
    6: "foundation-6-social-express",
    7: "foundation-7-travel-basic",
    8: "foundation-8-integrated-express",
    9: "foundation-9-describe-compare",
    10: "foundation-10-clause-gerund-infinitive",
}
STOP = {
    "i",
    "a",
    "an",
    "the",
    "is",
    "am",
    "are",
    "was",
    "were",
    "be",
    "he",
    "she",
    "it",
    "we",
    "they",
    "you",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
    "its",
    "our",
    "their",
    "to",
    "in",
    "on",
    "at",
    "of",
    "for",
    "with",
    "by",
    "from",
    "up",
    "out",
    "and",
    "but",
    "or",
    "so",
    "if",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "can",
    "could",
    "will",
    "would",
    "shall",
    "should",
    "may",
    "might",
    "must",
    "not",
    "no",
    "yes",
    "there",
    "here",
}


def hp(t):
    return "___" in t or "\u2026" in t


for n in range(1, 11):
    d = os.path.join(PKD, PKGS[n])
    with open(os.path.join(d, "training_topics.csv"), encoding="utf-8") as f:
        topics = list(csv.DictReader(f))
    with open(os.path.join(d, "chunks.csv"), encoding="utf-8") as f:
        chunks = list(csv.DictReader(f))
    with open(os.path.join(d, "sentence_patterns.csv"), encoding="utf-8") as f:
        patterns = list(csv.DictReader(f))
    with open(os.path.join(d, "scene_vocabulary.csv"), encoding="utf-8") as f:
        vocabs = list(csv.DictReader(f))
    # Build vocab word set for this package
    pkg_vocab_words = set()
    for v in vocabs:
        w = v.get("word", "").strip().lower()
        if w and len(w) > 1:
            pkg_vocab_words.add(w)
    # Build scene pools
    sc, sp, sv = {}, {}, {}
    for x in chunks:
        s = x["scene_title"]
        sc.setdefault(s, []).append(x)
    for x in patterns:
        s = x["scene_title"]
        sp.setdefault(s, []).append(x)
    for x in vocabs:
        s = x.get("scene_title", "")
        sv.setdefault(s, []).append(x)

    total = 0
    pipeline = {}
    for t in topics:
        if t is None:
            continue
        tn = t.get("title")
        scn = t.get("scene_title", "")
        if not tn:
            continue
        tn = tn.strip()
        scn = scn.strip() if scn else ""
        ci = [c for c in chunks if c["topic_title"].strip() == tn] or sc.get(scn, [])
        pa = [p for p in patterns if p["topic_title"].strip() == tn] or sp.get(scn, [])
        vo = sv.get(scn, [])

        # Build unique item pool: each zh appears only once
        # Priority: chunks with target words from vocab
        all_candidates = []
        used_zhes = set()

        for c in ci:
            zh, en = c["meaning"], c["text"]
            if hp(zh) or hp(en):
                continue
            if zh in used_zhes:
                continue

            # Find a target word from package vocab that appears in this chunk
            en_words = en.lower().split()
            target = ""
            for ew in en_words:
                ew_clean = ew.strip(".,?!;:'\"()[]")
                if ew_clean in pkg_vocab_words and ew_clean not in STOP:
                    target = ew_clean
                    break

            if target:
                used_zhes.add(zh)
                all_candidates.append({"zh": zh, "en": en, "tw": target})

        # If not enough from chunks, add from vocab directly
        if len(all_candidates) < 8:
            for v in vo:
                w, m = v.get("word", ""), v.get("meaning", "")
                if not w or not m or hp(w) or hp(m):
                    continue
                if m in used_zhes:
                    continue
                wl = w.lower().strip()
                if wl in pkg_vocab_words and wl not in STOP:
                    used_zhes.add(m)
                    all_candidates.append({"zh": m, "en": w, "tw": wl})
                    if len(all_candidates) >= 15:
                        break

        if not all_candidates:
            continue
        pipe, ix = [], 0

        # Split candidates across exercise types (NO zh overlap)
        half = min(5, len(all_candidates) // 3 or 1)
        set_zh = all_candidates[:half]
        set_en = all_candidates[half : half + min(4, len(all_candidates) // 2)]
        set_fl = all_candidates[
            half + min(4, len(all_candidates) // 2) : half
            + min(4, len(all_candidates) // 2)
            + min(3, len(all_candidates) // 3)
        ]

        # zh_to_en
        if set_zh:
            items = [
                {"zh": x["zh"], "answer": x["en"], "targetWord": x["tw"]}
                for x in set_zh
            ]
            pipe.append(
                {
                    "id": "cs_zh_" + str(ix),
                    "type": "chunk_substitution",
                    "kind": "word",
                    "direction": "zh_to_en",
                    "title": tn + " · 中译英",
                    "chunk": " / ".join([x["tw"] for x in set_zh[:3]]),
                    "chunkMeaning": "",
                    "items": items,
                }
            )
            total += len(items)
            ix += 1

        # en_to_zh (different zh prompts from zh_to_en)
        if set_en:
            items = [
                {"en": x["en"], "answer": x["zh"], "targetWord": x["tw"]}
                for x in set_en
            ]
            pipe.append(
                {
                    "id": "cs_en_" + str(ix),
                    "type": "chunk_substitution",
                    "kind": "word",
                    "direction": "en_to_zh",
                    "title": tn + " · 英译中",
                    "chunk": " / ".join([x["tw"] for x in set_en[:3]]),
                    "chunkMeaning": "",
                    "items": items,
                }
            )
            total += len(items)
            ix += 1

        # pattern
        if pa:
            items = []
            for p in pa[:5]:
                ex, sv2 = p.get("example", ""), {}
                sl = (
                    [s.strip() for s in p.get("slots", "").split("/") if s.strip()][:3]
                    if p.get("slots")
                    else []
                )
                for i, s in enumerate(sl):
                    sv2["slot" + str(i + 1)] = s
                if ex and not hp(ex):
                    items.append(
                        {
                            "zh": p["meaning"],
                            "answer": ex,
                            "pattern": p["pattern"],
                            "slotValues": sv2,
                        }
                    )
            if items:
                pipe.append(
                    {
                        "id": "pd_" + str(ix),
                        "type": "pattern_drill",
                        "title": tn + " · 句型",
                        "pattern": pa[0]["pattern"],
                        "patternMeaning": pa[0]["meaning"],
                        "slots": [
                            s.strip() for s in pa[0].get("slots", "").split("/")[:3]
                        ]
                        if pa[0].get("slots")
                        else [],
                        "direction": "zh_to_en",
                        "items": items,
                    }
                )
                total += len(items)
                ix += 1

        # sentence decomposition (different from above)
        sd_items = all_candidates[
            half
            + min(4, len(all_candidates) // 2)
            + min(3, len(all_candidates) // 3) : half
            + min(4, len(all_candidates) // 2)
            + min(3, len(all_candidates) // 3)
            + 3
        ]
        if len(sd_items) >= 2:
            lv = []
            for i in range(min(3, len(sd_items))):
                lv.append(
                    {
                        "level": i + 1,
                        "label": ["基础句", "加细节", "扩展"][i],
                        "en": sd_items[i]["en"],
                        "zh": sd_items[i]["zh"],
                        "highlight": sd_items[i]["tw"],
                        "hint": ["从简单开始", "加信息", "扩展表达"][i],
                    }
                )
            pipe.append(
                {
                    "id": "sd_" + str(ix),
                    "type": "sentence_decomposition",
                    "title": tn + " · 逐步构建",
                    "levels": lv,
                }
            )
            total += len(lv)
            ix += 1
        elif len(set_zh) >= 2:
            # Fallback: use set_zh items for SD
            lv = []
            for i in range(min(2, len(set_zh))):
                lv.append(
                    {
                        "level": i + 1,
                        "label": ["基础句", "加细节"][i],
                        "en": set_zh[i]["en"],
                        "zh": set_zh[i]["zh"],
                        "highlight": set_zh[i]["tw"],
                        "hint": ["从简单开始", "加信息"][i],
                    }
                )
            pipe.append(
                {
                    "id": "sd_" + str(ix),
                    "type": "sentence_decomposition",
                    "title": tn + " · 逐步构建",
                    "levels": lv,
                }
            )
            total += len(lv)
            ix += 1

        # focus last word (different zh from all above)
        if set_fl:
            items = []
            for x in set_fl:
                ws = x["en"].split()
                if len(ws) >= 3:
                    lw = ws[-1].strip(".,?!;:'\"()[]").lower()
                    if lw in pkg_vocab_words and lw not in STOP:
                        items.append(
                            {"zh": x["zh"], "answer": x["en"], "targetWord": lw}
                        )
            if items:
                pipe.append(
                    {
                        "id": "fl_" + str(ix),
                        "type": "chunk_substitution",
                        "kind": "word",
                        "direction": "zh_to_en",
                        "title": tn + " · 末尾词",
                        "chunk": "",
                        "chunkMeaning": "",
                        "items": items,
                    }
                )
                total += len(items)

        if pipe:
            pipeline[tn] = {
                "outputTraining": {"version": 1, "enabled": True, "pipeline": pipe}
            }

    with open(os.path.join(d, "warmup_pipeline.json"), "w", encoding="utf-8") as f:
        json.dump(pipeline, f, ensure_ascii=False, indent=2)
    print(f"{PKGS[n]}: {total} items")
print("DONE")
