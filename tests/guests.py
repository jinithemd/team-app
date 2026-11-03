# Sample-data build: guest players. Priya (Strikers captain) adds Marcus (a Clbx account, found by
# email) and Marco (typed in, email only) to the guest list, posts a match to the team and all
# guests, Marco answers from his email without signing in, Marcus answers in the app and can't
# open the team's pages. A one-off guest for one game stays off the list; training defaults to
# the team only.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect, Locator

_click = Locator.click
def _settled_click(self, *a, **k):
    _click(self, *a, **k)
    try:
        self.page.wait_for_load_state("networkidle", timeout=6000)
    except Exception:
        pass
Locator.click = _settled_click

BASE = "http://localhost:3000"
SHOTS = "/tmp/claude-0"
errors = []

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def no_sideways(p, where):
    w = p.evaluate("document.documentElement.scrollWidth")
    assert w <= 391, f"sideways scroll on {where}: {w}"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))

    # 1) The guest list on the Roster tab.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/roster")
    gl = p.get_by_role("region", name=re.compile("Guest players"))
    gl.get_by_role("button", name="Add a guest player").click()
    gl.get_by_label("Find their Clbx profile").fill("marcus.lee@example.com")
    gl.get_by_role("list", name="People found").get_by_role("button", name=re.compile("Marcus Lee")).click()
    expect(gl.get_by_role("status")).to_contain_text("Marcus Lee is on your guest list")
    gl.get_by_role("button", name="Not on Clbx? Add them by name").click()
    gl.get_by_label("Name", exact=True).fill("Marco Silva")
    gl.get_by_label(re.compile("^Email")).fill("marco.silva@example.org")
    gl.get_by_role("button", name="Add guest").click()
    expect(gl.get_by_role("status")).to_contain_text("Marco Silva is on your guest list")
    expect(gl.get_by_role("list", name="Guest players")).to_contain_text("Marcus Lee")
    expect(gl.get_by_role("list", name="Guest players")).to_contain_text("Marco Silva")
    # Searching again: someone already on the list or the roster isn't offered.
    gl.get_by_label("Find their Clbx profile").fill("marcus.lee@example.com")
    expect(gl.get_by_text("No one found")).to_be_visible()
    gl.get_by_label("Find their Clbx profile").fill("rahul.menon@example.com")
    expect(gl.get_by_text("No one found")).to_be_visible()
    no_sideways(p, "roster with guests")
    gl.screenshot(path=f"{SHOTS}/guests-list.png")

    # 2) A new match: guests are in by default ("the team and all 2 guest players").
    p.goto(f"{BASE}/t/t-strikers/e/new")
    who = p.get_by_role("group", name="Who gets this?")
    expect(who.get_by_label("The team and all 2 guest players")).to_be_checked()
    # Training: the team only, by default.
    p.get_by_role("radio", name="Training").click()
    expect(who.get_by_label("The team only")).to_be_checked()
    p.get_by_role("radio", name="Match").click()
    expect(who.get_by_label("The team and all 2 guest players")).to_be_checked()
    p.fill("#opponent", "Guest Test FC")
    p.fill("#date", "2026-12-06")
    p.screenshot(path=f"{SHOTS}/guests-new-event.png", full_page=True)
    p.get_by_role("button", name="Add match").click()
    p.wait_for_url(re.compile(r"/t/t-strikers/e/[^/?]+\?created=1"))
    eid = re.search(r"/e/([^/?]+)", p.url).group(1)
    card = p.get_by_role("region", name=re.compile("Guest players"))
    expect(card).to_contain_text("0 of 2 going")
    expect(card.get_by_role("list", name="Guests asked")).to_contain_text("Marcus Lee")
    expect(card.get_by_role("list", name="Guests asked")).to_contain_text("Marco Silva")

    # 3) Marco answers from his email, without signing in.
    p.goto(f"{BASE}/dev/outbox")
    mail = p.locator("article, li, section").filter(has_text="marco.silva@example.org").filter(has_text="Guest Test FC").first
    href = mail.get_by_role("link", name="Going", exact=True).get_attribute("href")
    assert href and href.startswith("/gr/"), href
    anon = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    anon.goto(f"{BASE}{href}")
    expect(anon.get_by_text("You're in, Marco")).to_be_visible()
    expect(anon.get_by_text(re.compile("Kingston Strikers · vs Guest Test FC"))).to_be_visible()
    anon.screenshot(path=f"{SHOTS}/guests-email-answer.png")
    p.goto(f"{BASE}/t/t-strikers/e/{eid}")
    expect(p.get_by_role("region", name=re.compile("Guest players"))).to_contain_text("1 of 2 going")

    # 4) A one-off guest for this match only: not kept on the list.
    card = p.get_by_role("region", name=re.compile("Guest players"))
    card.get_by_role("button", name="Add guest players").click()
    card.get_by_role("button", name="Not on Clbx? Add them by name").click()
    card.get_by_label("Name", exact=True).fill("Owen Oneoff")
    card.get_by_label(re.compile("Keep them on our guest list")).uncheck()
    card.get_by_role("button", name="Add guest").click()
    expect(card.get_by_role("status")).to_contain_text("Owen Oneoff is asked")
    expect(card.get_by_role("list", name="Guests asked")).to_contain_text("just this game")
    # The captain fills in an answer for someone who told them in person.
    card.get_by_label("Owen Oneoff's answer").select_option("going")
    expect(card).to_contain_text("2 of 3 going")
    no_sideways(p, "event with guests")
    card.screenshot(path=f"{SHOTS}/guests-event-card.png")
    p.goto(f"{BASE}/t/t-strikers/roster")
    expect(p.get_by_role("list", name="Guest players")).not_to_contain_text("Owen Oneoff")

    # 5) Marcus (a guest with an account) sees it on Home and answers in the app.
    login(p, "Marcus")
    home = p.get_by_role("region", name="You're invited as a guest")
    expect(home).to_contain_text("vs Guest Test FC")
    home.get_by_role("link", name=re.compile("Guest Test FC")).click()
    p.wait_for_url(f"{BASE}/guest/{eid}")
    expect(p.get_by_text("You're a guest")).to_be_visible()
    p.get_by_role("radio", name="Maybe").click()
    expect(p.get_by_role("radio", name="Maybe")).to_have_attribute("aria-checked", "true")
    no_sideways(p, "guest game page")
    p.screenshot(path=f"{SHOTS}/guests-guest-page.png", full_page=True)
    # Guests don't get into the team's own pages.
    p.goto(f"{BASE}/t/t-strikers/e/{eid}")
    expect(p.get_by_role("heading", name="We couldn't find that page")).to_be_visible()
    p.goto(f"{BASE}/t/t-strikers/chat")
    expect(p.get_by_text("Guest Test FC")).to_have_count(0)

    # 6) Priya sees his answer; the invite emails went out.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/e/{eid}")
    expect(p.get_by_role("region", name=re.compile("Guest players"))).to_contain_text("Maybe")
    p.goto(f"{BASE}/dev/outbox")
    expect(p.get_by_text(re.compile("You're invited: vs Guest Test FC")).first).to_be_visible()
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("guests: all checks pass")
