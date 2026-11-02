# Sample-data build: a player who was in pulls out of Tuesday's training (within 48 hours),
# and the captain gets one email. Pulling out of something a week away sends nothing.
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def answer(p, event, label):
    p.goto(f"{BASE}/t/t-strikers/e/{event}")
    p.get_by_role("button", name=label, exact=True).click()
    p.wait_for_load_state("networkidle")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    login(p, "Rahul")
    answer(p, "e-s-p-tue-0", "Going")
    answer(p, "e-s-p-tue-0", "Can't make it")
    answer(p, "e-s-p-tue-2", "Going")          # two weeks away
    answer(p, "e-s-p-tue-2", "Can't make it")
    p.goto(f"{BASE}/dev/outbox")
    body = p.locator("body").inner_text()
    near = [l for l in body.splitlines() if "Rahul Menon can't make it" in l]
    print("\n".join(near))
    assert near, "no alert"
    assert all("Nov 3" in l or "November 3" in l for l in near), "an alert went out for the event two weeks away"
    assert "priya" in body.lower(), "captain wasn't emailed"
    b.close()
print("dropout: all checks pass")
