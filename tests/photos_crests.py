# Sample-data build: a player adds a profile photo; teammates see it; crests show across team spaces.
import re, io, base64, zlib, struct
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
def png(w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
errors = []

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: errors.append(m.text) if m.type == "error" and "404" not in m.text and "Failed to load resource" not in m.text else None)

    # Rahul adds a photo (a wide image: it gets cropped square).
    login(p, "Rahul")
    p.goto(f"{BASE}/account")
    p.set_input_files("input[aria-label='Photo file']", files=[{"name": "me.png", "mimeType": "image/png", "buffer": png(600, 400, (200, 30, 60))}])
    expect(p.get_by_text("Photo saved.")).to_be_visible()
    expect(p.get_by_role("button", name="Remove")).to_be_visible()
    p.reload()
    expect(p.get_by_role("button", name="Change photo")).to_be_visible()

    # Priya (same team) sees it on the roster: the image loads (naturalWidth > 0).
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/roster")
    img = p.locator("li", has_text="Rahul").locator("img[src*='/api/img/photo/']").first
    expect(img).to_be_attached()
    p.wait_for_function("el => el.complete && el.naturalWidth > 0", arg=img.element_handle())

    # Priya adds a crest in team settings; it shows on Teams, Home and Chat.
    p.goto(f"{BASE}/t/t-strikers/settings")
    p.set_input_files("input[aria-label='Crest file']", files=[{"name": "crest.png", "mimeType": "image/png", "buffer": png(64, 64, (20, 120, 220))}])
    p.get_by_role("button", name=re.compile("^Save")).first.click()
    p.wait_for_timeout(1500)
    for path in ["/teams", "/", "/chat"]:
        p.goto(f"{BASE}{path}")
        c = p.locator("img[src*='/api/img/crest/t-strikers']").first
        expect(c).to_be_attached()
        p.wait_for_function("el => el.complete && el.naturalWidth > 0", arg=c.element_handle())
    p.screenshot(path="/tmp/claude-0/chat-crests.png")
    p.goto(f"{BASE}/teams"); p.screenshot(path="/tmp/claude-0/teams-crests.png")

    # Someone outside the team can't fetch Rahul's photo.
    login(p, "Sid")
    r = p.request.get(f"{BASE}/api/img/photo/u-rahul")
    assert r.status == 404, r.status

    # Remove the photo.
    login(p, "Rahul"); p.goto(f"{BASE}/account")
    p.get_by_role("button", name="Remove").click()
    expect(p.get_by_text("Photo removed.")).to_be_visible()
    b.close()
assert not errors, errors
print("photos_crests: all checks pass")
