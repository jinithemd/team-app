# The front page: signed-out visitors to clbx.ca see it; signed-in members and the phone app don't.
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h, name in ((390, 844, "phone"), (1440, 900, "desktop")):
        p = b.new_context(viewport={"width": w, "height": h}).new_page()
        p.on("pageerror", lambda e: errors.append(str(e)[:120]))
        p.goto(f"{BASE}/"); p.wait_for_load_state("networkidle")
        assert p.url == f"{BASE}/", p.url
        expect(p.get_by_role("heading", level=1)).to_contain_text("Who's in?")
        expect(p.get_by_role("link", name="Start your team").first).to_be_visible()
        sw = p.evaluate("document.documentElement.scrollWidth"); assert sw <= w + 1, (name, sw)
        bad = p.evaluate("[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)")
        assert not bad, bad
        p.screenshot(path=f"/tmp/claude-0/welcome-{name}.png", full_page=True)
        if name == "phone":
            p.get_by_role("link", name="Start your team").first.click(); p.wait_for_url("**/login**")
            p.locator("form", has_text="Priya").first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")
            expect(p.get_by_role("heading", level=1)).not_to_contain_text("Who's in?")
    # The phone app goes straight to sign-in.
    a = b.new_context(user_agent="Mozilla/5.0 (Linux; Android 14) ClbxApp").new_page()
    a.goto(f"{BASE}/"); a.wait_for_url("**/login**")
    b.close()
assert not [e for e in errors if "#418" not in e], errors
print("welcome: all checks pass")
