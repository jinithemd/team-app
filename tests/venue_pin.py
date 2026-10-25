# Sample-data build: a captain pins a venue from anywhere (search suggestions, map, link).
# Outside services are stubbed: Photon search answers; the first street-map server fails so
# the fallback server must take over.
import re, base64
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
errors, tiles = [], {"osm": 0, "carto": 0, "esri": 0}

def photon(route):
    route.fulfill(json={"features": [
        {"geometry": {"coordinates": [-76.4861, 44.2312]}, "properties": {"name": "Caraco Park", "city": "Kingston", "state": "Ontario", "country": "Canada"}},
        {"geometry": {"coordinates": [-76.55, 44.26]}, "properties": {"name": "Caraco Field", "city": "Kingston", "country": "Canada"}},
    ]})

def tile(kind, ok):
    def h(route):
        tiles[kind] += 1
        route.fulfill(status=200, body=PNG, content_type="image/png") if ok else route.abort()
    return h

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.route("https://photon.komoot.io/**", photon)
    ctx.route("https://tile.openstreetmap.org/**", tile("osm", False))
    ctx.route(re.compile(r"https://[a-d]\.basemaps\.cartocdn\.com/.*"), tile("carto", True))
    ctx.route("https://server.arcgisonline.com/**", tile("esri", True))
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(f"{BASE}/login")
    p.locator("form", has_text="Priya").first.get_by_role("button").click()
    p.wait_for_url(f"{BASE}/")
    p.goto(f"{BASE}/t/t-strikers/venues")
    p.fill("#name", "Test Ground")

    # Search as you type: suggestions appear, picking one pins it and fills the address.
    p.locator("#place-q").press_sequentially("Caraco", delay=40)
    expect(p.get_by_role("option").first).to_contain_text("Caraco Park")
    p.get_by_role("option").first.click()
    expect(p.get_by_text("Pinned at Caraco Park")).to_be_visible()
    expect(p.locator("#address")).to_have_value(re.compile("Caraco Park"))
    p.get_by_text("Coordinates and other options").click()
    expect(p.locator("#lat")).to_have_value("44.2312")

    # Street tiles: OSM failed, Carto took over. Satellite switch loads imagery.
    p.wait_for_timeout(1500)
    assert tiles["carto"] > 0, tiles
    p.get_by_role("button", name="satellite").click()
    p.wait_for_timeout(1000)
    assert tiles["esri"] > 0, tiles

    # Tap the map: the pin moves.
    box = p.get_by_role("application").bounding_box()
    p.mouse.click(box["x"] + box["width"] * 0.8, box["y"] + box["height"] * 0.3)
    expect(p.get_by_text("Pin moved.")).to_be_visible()

    # Long Google Maps link.
    p.fill("#place-link", "https://www.google.com/maps/place/X/@44.2300,-76.4800,17z/data=!3m1!4b1!4m6!3m5!1s0:0!8m2!3d44.2312!4d-76.4861")
    p.get_by_role("button", name="Use", exact=True).click()
    expect(p.locator("#lat")).to_have_value("44.2312")
    p.screenshot(path="/tmp/claude-0/venue.png", full_page=True)

    p.get_by_role("button", name="Add venue").click()
    expect(p.locator("li", has_text="Test Ground").get_by_text("Pinned")).to_be_visible()
    b.close()
assert not errors, errors
print("venue_pin: all checks pass", tiles)
