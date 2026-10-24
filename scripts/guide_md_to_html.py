"""Convert a claude-blog markdown draft into a PublicJobs.ca guide body (no H1, no frontmatter)."""
import re
import sys

import markdown

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()
text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
text = re.sub(r"\A\s*# .*\n", "", text)

html = markdown.markdown(text, extensions=["tables", "sane_lists"], output_format="html")
html = html.replace("<table>", '<div class="stats-table-wrap"><table class="stats-table">').replace(
    "</table>", "</table></div>"
)
html = html.replace("hello@publicjobs.ca", '<a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>')
for dash in ("—", "–"):
    if dash in html:
        sys.exit(f"dash {dash!r} found; fix the draft")
open(out, "w", encoding="utf-8", newline="\n").write(html.strip() + "\n")
print(f"wrote {out}: {len(html)} chars")
