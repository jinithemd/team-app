# Sample-data build: the team sheet. Priya (captain) picks the team for Saturday's match,
# changes the formation, moves a player, saves and gets a shareable picture. Rahul (a player)
# sees the same team, read-only.
import re
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
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-strikers/e/e-s-g1")
    expect(p.get_by_role("link", name=re.compile("Pick the team"))).to_have_count(0)   # players don't see it yet
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/e/e-s-g1")
    p.get_by_role("link", name=re.compile("Pick the team")).click(); p.wait_for_url("**/lineup")
    expect(p.get_by_role("heading", name="Team sheet")).to_be_visible()
    expect(p.get_by_label("Players a side")).to_have_value("11")
    p.get_by_role("radio", name="4-3-3").click()
    p.get_by_role("button", name="Auto-pick").click()
    pitch = p.get_by_role("list", name="Starting line-up")
    filled = pitch.locator("button[aria-label*=': ']").filter(has_not_text="Pick")
    n_before = pitch.get_by_role("button", name=re.compile(r"empty")).count()
    # Put someone who said maybe into an empty spot.
    pitch.get_by_role("button", name=re.compile(r"empty")).first.click()
    maybe_row = p.get_by_role("list").filter(has_text="Maybe").locator("li", has_text="Maybe").first
    maybe_row.get_by_role("button").first.click()
    assert pitch.get_by_role("button", name=re.compile(r"empty")).count() == n_before - 1
    # Bench someone.
    p.locator("section[aria-labelledby='squad-h'] li", has_text="Can't").first.get_by_role("button", name="Bench").click()
    p.screenshot(path="/tmp/claude-0/lineup-edit.png", full_page=True)
    sw = p.evaluate("document.documentElement.scrollWidth"); assert sw <= 391, sw
    p.get_by_role("button", name="Save team").click()
    expect(p.get_by_text("Team saved. Everyone on the team can see it now.")).to_be_visible()
    # The share picture renders.
    img = p.get_by_role("img", name=re.compile("Team sheet for"))
    expect(img).to_be_visible()
    p.wait_for_function("(el) => el.complete && el.naturalWidth > 0", arg=img.element_handle())
    r = p.request.get(f"{BASE}/api/share/lineup/e-s-g1"); assert r.status == 200 and r.headers["content-type"] == "image/png", r.status
    open("/tmp/claude-0/lineup-share.png", "wb").write(r.body())
    # Rahul sees it read-only.
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-strikers/e/e-s-g1")
    p.get_by_role("link", name=re.compile("Team sheet")).click(); p.wait_for_url("**/lineup")
    expect(p.get_by_role("list", name="Starting line-up")).to_be_visible()
    expect(p.get_by_role("button", name="Save team")).to_have_count(0)
    expect(p.get_by_role("radio", name="4-3-3")).to_have_count(0)
    p.screenshot(path="/tmp/claude-0/lineup-view.png", full_page=True)
    b.close()
assert not [e for e in errors if "#418" not in e], errors
print("lineup: all checks pass")
