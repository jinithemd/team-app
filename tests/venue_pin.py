# Sample-data build: a captain pins a venue without being there (paste a link, tap the map).
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(f"{BASE}/login")
    p.locator("form", has_text="Priya").first.get_by_role("button").click()
    p.wait_for_url(f"{BASE}/")
    p.goto(f"{BASE}/t/t-strikers/venues")
    expect(p.get_by_text("Set it from anywhere")).to_be_visible()
    p.fill("#name", "Test Ground")
    # Paste a long Google Maps link: pin comes from !3d/!4d.
    p.fill("#place-link", "https://www.google.com/maps/place/X/@44.2300,-76.4800,17z/data=!3m1!4b1!4m6!3m5!1s0:0!8m2!3d44.2312!4d-76.4861")
    p.get_by_role("button", name="Use", exact=True).click()
    expect(p.get_by_text("Pinned from your link")).to_be_visible()
    p.get_by_text("Coordinates and other options").click()
    expect(p.locator("#lat")).to_have_value("44.2312")
    expect(p.locator("#lng")).to_have_value("-76.4861")
    # Tap the map: the pin moves.
    m = p.get_by_role("application")
    expect(m).to_be_visible()
    box = m.bounding_box()
    p.mouse.click(box["x"] + box["width"] * 0.8, box["y"] + box["height"] * 0.3)
    expect(p.get_by_text("Pin moved.")).to_be_visible()
    assert p.locator("#lat").input_value() != "44.2312"
    # Search box accepts plain coordinates too.
    p.fill("#place-q", "44.25, -76.5"); p.get_by_role("button", name="Search").click()
    expect(p.locator("#lat")).to_have_value("44.25")
    p.screenshot(path="/tmp/claude-0/venue.png", full_page=True)
    p.get_by_role("button", name="Add venue").click()
    p.wait_for_load_state("networkidle")
    expect(p.get_by_text("Test Ground")).to_be_visible()
    expect(p.locator("li", has_text="Test Ground").get_by_text("Pinned")).to_be_visible()
    b.close()
assert not errors, errors
print("venue_pin: all checks pass")
