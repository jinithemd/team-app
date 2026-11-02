# Sample-data build: sponsors show on the team's public page header (top three, highest tier first,
# each opening its website), and not on the players' team screens.
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
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/chat")
    expect(p.get_by_label("Sponsors", exact=True)).to_have_count(0)
    p.goto(f"{BASE}/f/t-strikers")
    row = p.get_by_label("Sponsors", exact=True)
    chips = row.locator(":scope > a.shadow-sm, :scope > div")
    expect(chips).to_have_count(3)
    expect(chips.first).to_contain_text("Gold")
    site = row.get_by_role("link", name=re.compile("opens their website")).first
    expect(site).to_have_attribute("href", re.compile(r"^https?://"))
    expect(site).to_have_attribute("target", "_blank")
    sw = p.evaluate("document.documentElement.scrollWidth"); assert sw <= 391, sw
    p.screenshot(path="/tmp/claude-0/header-sponsors-public.png")
    login(p, "Dan")
    p.goto(f"{BASE}/f/t-first")
    expect(p.get_by_label("Sponsors", exact=True)).to_contain_text("Limestone Motors")
    b.close()
print("header_sponsors: all checks pass")
