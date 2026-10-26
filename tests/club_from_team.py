# Sample-data build: a captain whose team isn't in a club turns it into one and hosts.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(f"{BASE}/login"); p.locator("form", has_text="Priya").first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")
    p.goto(f"{BASE}/tournaments"); p.wait_for_load_state("networkidle")
    p.get_by_role("link", name="Host a tournament").click(); p.wait_for_url(f"{BASE}/tournaments/new"); p.wait_for_load_state("networkidle")
    expect(p.get_by_text("First, make your team a club")).to_be_visible()
    p.get_by_role("button", name="Make Kingston Strikers a club and host").click()
    p.wait_for_url(re.compile(r"/tournaments/new\?club=1")); p.wait_for_load_state("networkidle")
    expect(p.get_by_text("Your club is set up")).to_be_visible()
    expect(p.locator("#clubId option")).to_have_text(["Kingston Strikers"])
    p.fill("#name", "Strikers Cup"); p.get_by_role("button", name="Create tournament").click()
    p.wait_for_url(re.compile(r"/teams\?created=1"))
    # The team now sits in the club.
    p.goto(f"{BASE}/teams"); expect(p.get_by_role("heading", name="Clubs you run")).to_be_visible()
    b.close()
assert not [e for e in errors if "#418" not in e], errors
print("club_from_team: all checks pass")
