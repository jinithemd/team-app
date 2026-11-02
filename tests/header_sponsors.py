# Sample-data build: a team's major sponsors (Diamond, Platinum, Gold) show in the team header
# with their tier badges; the rest are a "+N more" link to the full list.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    login(p, "Dan")
    p.goto(f"{BASE}/t/t-first/roster")
    row = p.get_by_label("Major sponsors")
    expect(row).to_contain_text("Limestone Motors")
    expect(row).to_contain_text("Diamond")
    expect(row).to_contain_text("Platinum")
    p.screenshot(path="/tmp/claude-0/header-sponsors-club.png")
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/chat")
    row = p.get_by_label("Major sponsors")
    expect(row).to_contain_text("Corner Cafe")
    expect(row).to_contain_text("Gold")
    expect(row.get_by_role("link", name=re.compile(r"\+2 more sponsors"))).to_be_visible()
    sw = p.evaluate("document.documentElement.scrollWidth"); assert sw <= 391, sw
    p.screenshot(path="/tmp/claude-0/header-sponsors-team.png")
    b.close()
print("header_sponsors: all checks pass")
