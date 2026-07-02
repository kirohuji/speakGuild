"""Check for duplicate answers in warmup_pipeline.json files."""

import json
import os

PKD = r"C:\Users\z1309\Desktop\work\speakGuild\apps\backend\prisma\data\packages"
dirs = {
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

for n in range(1, 11):
    path = os.path.join(PKD, dirs[n], "warmup_pipeline.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    seen_answers = {}  # answer -> list of (topic, exercise_type, zh/en)
    total_dups = 0

    for tname, tdata in data.items():
        for pipe in tdata["outputTraining"]["pipeline"]:
            ex_type = pipe.get("type", "")
            ex_title = pipe.get("title", "")
            for item in pipe.get("items", []):
                ans = item.get("answer", "")
                if ans:
                    if ans in seen_answers:
                        prev = seen_answers[ans]
                        total_dups += 1
                        if total_dups <= 5:
                            print(f'{dirs[n]}: DUPLICATE answer "{ans[:40]}..."')
                            print(f"  first: {prev[0]} / {prev[1]}")
                            print(f"  also:  {tname} / {ex_title}")
                    else:
                        seen_answers[ans] = (tname, ex_title)

    if total_dups == 0:
        print(f"{dirs[n]}: NO duplicate answers")
    else:
        print(f"{dirs[n]}: {total_dups} duplicate answers")
    print()
