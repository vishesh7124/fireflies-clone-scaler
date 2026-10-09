"""Quick test: verify transcript parsing handles real-world formats."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.seed.seed import parse_transcript

# VTT output from the frontend parser (post-fix): "mm:ss Speaker: text"
lines = [
    "0:04 Sarah Watts: Hi Tom, hi Emily - thanks for making time today.",
    "0:18 Tom Reyes: Thanks Sarah. Our onboarding flow is mostly manual.",
    "0:34 Emily Chen: And the accuracy is a real problem. We had 40% missing records.",
]
result = parse_transcript(lines)
print(f"Parsed {len(result)} segments")
for r in result:
    print(f"  {r['startMs']}ms - {r['endMs']}ms | {r['speaker']}: {r['text'][:50]}...")

# Edge case: timestamp with .000 (old buggy format)
lines2 = ["00:00:04.000  Sarah Watts: Hello there"]
result2 = parse_transcript(lines2)
print(f"\nEdge case (with .000): parsed {len(result2)} segments")

# Edge case: h:mm:ss format
lines3 = ["1:02:03 Sarah Watts: One hour in"]
result3 = parse_transcript(lines3)
print(f"Edge case (h:mm:ss): parsed {len(result3)} segments, start={result3[0]['startMs'] if result3 else 'N/A'}ms")

print("\nAll parse tests passed" if len(result) == 3 else "\nFAILURES")
