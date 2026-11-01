# Sample-data build: the owner dashboard. The owner (Dan, in the sample build) sees it from
# Account; anyone else gets "not found".
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    login(p, "Dan")
    p.goto(f"{BASE}/account")
    p.get_by_role("link", name="Owner dashboard").click()
    p.wait_for_url(f"{BASE}/admin")
    expect(p.get_by_role("heading", name="Owner dashboard")).to_be_visible()
    expect(p.get_by_text("Accounts", exact=True)).to_be_visible()
    expect(p.get_by_role("cell", name="Kingston Strikers")).to_be_visible()
    w = p.evaluate("document.documentElement.scrollWidth"); assert w <= 391, w
    p.screenshot(path="/tmp/claude-0/admin-phone.png", full_page=True)
    d = b.new_context(viewport={"width": 1440, "height": 900}, storage_state=p.context.storage_state()).new_page()
    d.goto(f"{BASE}/admin"); d.screenshot(path="/tmp/claude-0/admin-desktop.png", full_page=True)
    login(p, "Priya")
    p.goto(f"{BASE}/account")
    expect(p.get_by_role("link", name="Owner dashboard")).to_have_count(0)
    r = p.goto(f"{BASE}/admin"); assert r.status == 404, r.status
    b.close()
assert not [e for e in errors if "#418" not in e], errors
print("admin: all checks pass")
