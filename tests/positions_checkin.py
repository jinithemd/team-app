# Sample-data build: a player picks positions from the list and saves them; a player sees why
# check-in isn't available when the event has no pinned place, and staff get a warning.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

def login(p, who):
    p.context.clear_cookies()
    p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click()
    p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))

    # Rahul is a plain player on the Strikers.
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-strikers/you")
    expect(p.get_by_text("pick up to 3")).to_be_visible()
    print("seeded:", p.locator("button[aria-pressed=true]").all_inner_texts())
    while p.locator("fieldset button[aria-pressed=true]").count():
        p.locator("fieldset button[aria-pressed=true]").first.click()
    for pos in ["Central midfielder", "Winger", "Striker"]:
        p.get_by_role("button", name=pos, exact=True).click()
    expect(p.get_by_role("button", name="Goalkeeper", exact=True)).to_be_disabled()
    expect(p.get_by_text("Central midfielder, Winger, Striker")).to_be_visible()  # roster preview
    p.fill("#jersey", "77")
    p.get_by_role("button", name="Save").click()
    p.wait_for_url(re.compile(r"/roster"))
    p.goto(f"{BASE}/t/t-strikers/you")
    expect(p.get_by_role("button", name="Winger", exact=True)).to_have_attribute("aria-pressed", "true")
    expect(p.locator("#jersey")).to_have_value("77")

    # Captain makes an event with no place; player sees the explanation, captain the warning.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/e/new")
    p.fill("#opponent", "No Pin FC")
    p.locator("input[name=startTime], #startTime").first.fill("22:00")
    p.select_option("#venueId", "")
    p.get_by_role("button", name=re.compile("^Add ")).click()
    p.wait_for_url(re.compile(r"/e/[^/?]+\?created=1"))
    ev = p.url.split("?")[0]
    expect(p.get_by_text("Players can't check in to this one")).to_be_visible()
    login(p, "Rahul")
    p.goto(ev)
    expect(p.get_by_text("Check-in isn't available for this event")).to_be_visible()
    b.close()
assert not errors, errors
print("positions_checkin: all checks pass")
