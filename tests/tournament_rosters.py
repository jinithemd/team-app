# Sample-data build: tournament rosters. The host sets limits and criteria; a team adds
# players (from its team and by hand), a manager and a coach, and submits. After that only
# the host can change it, and each host change is marked for everyone.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect, Locator

_click = Locator.click
def _settled_click(self, *a, **k):
    _click(self, *a, **k)
    try:
        self.page.wait_for_load_state("networkidle", timeout=10000)
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
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto")
    ctx.route("https://photon.komoot.io/**", lambda r: r.abort())
    ctx.route(re.compile(r"https://.*(openstreetmap|cartocdn|arcgisonline).*"), lambda r: r.abort())
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(p.url + " " + str(e)[:80]))
    p.on("dialog", lambda d: d.accept())

    # Dan hosts, with a 3-player limit, at least 2, and criteria.
    login(p, "Dan")
    p.goto(f"{BASE}/tournaments/new")
    p.fill("#name", "Roster Cup")
    p.get_by_role("radio", name=re.compile("^Knockout")).click()
    p.fill("#startsOn", "2026-12-05"); p.fill("#endsOn", "2026-12-05")
    p.fill("#rosterMax", "3"); p.fill("#rosterMin", "2")
    p.fill("#rosterRules", "Players must be 18 or older\nEach player on one team only")
    p.get_by_role("button", name="Create tournament").click()
    p.wait_for_url(re.compile(r"/tournaments/[^/]+/teams\?created=1"))
    tid = re.search(r"/tournaments/([^/]+)/teams", p.url).group(1)
    p.fill("#team-q", "Strikers"); p.get_by_role("button", name="Search").click(); p.wait_for_url(re.compile(r"q=Strikers"))
    p.locator("li", has_text="Kingston Strikers").get_by_role("button", name="Invite").click()
    expect(p.get_by_text("Invited", exact=True)).to_be_visible()
    p.get_by_text("Add a team that isn't on Clbx").click()
    p.fill("#guestName", "Bath Road Rovers"); p.get_by_role("button", name="Add team").click()
    expect(p.get_by_role("status").filter(has_text="Added Bath Road Rovers")).to_be_visible()

    # Priya accepts, then fills in the roster.
    login(p, "Priya")
    p.goto(f"{BASE}/tournaments")
    p.get_by_role("button", name="Accept for Kingston Strikers").click()
    expect(p.get_by_role("heading", name="Playing in")).to_be_visible()
    p.goto(f"{BASE}/tournaments/{tid}")
    expect(p.get_by_text("Up to 3 players, at least 2, plus a manager and a coach")).to_be_visible()
    p.get_by_role("link", name="Add your roster").click()
    p.wait_for_url(re.compile(r"/teams/[^/?]+$"))
    roster_url = p.url
    expect(p.get_by_role("heading", name="Kingston Strikers roster")).to_be_visible()
    expect(p.get_by_text("Players must be 18 or older")).to_be_visible()
    expect(p.get_by_text("Not submitted yet.")).to_be_visible()
    expect(p.get_by_role("button", name="Submit roster")).to_be_disabled()

    # Two from the team, numbers filled in from their team profile (or typed).
    p.get_by_text("Add from your team").click()
    picks = p.locator("input[name='pick']")
    box = p.locator("input[name^='jersey_']").first.bounding_box()
    assert box["width"] < 80, f"number box too wide: {box['width']}"
    p.locator("details", has_text="Add from your team").screenshot(path=f"{SHOTS}/roster-pick.png")
    assert picks.count() >= 2, picks.count()
    for i in range(2):
        picks.nth(i).check()
        num = p.locator("input[name^='jersey_']").nth(i)
        if not num.input_value(): num.fill(str(70 + i))
    p.get_by_role("button", name="Add 2 players").click()
    expect(p.get_by_role("status").filter(has_text="Added 2 players")).to_be_visible()
    first_num = p.locator("#players-h ~ ul li").first.locator("span[aria-label^='Number']").inner_text()

    # A number that's taken is refused; a free one goes in, then the roster is full.
    p.fill("#player-new-jersey", first_num); p.fill("#player-new-name", "Sam Okafor")
    p.get_by_role("button", name="Add", exact=True).last.click()
    expect(p.get_by_text(f"#{first_num} is already")).to_be_visible()
    expect(p.locator("#player-new-name")).to_have_value("Sam Okafor")
    p.fill("#player-new-jersey", "99"); p.get_by_role("button", name="Add", exact=True).last.click()
    expect(p.get_by_text("The roster is full (3 players).")).to_be_visible()
    expect(p.locator("#player-new-name")).to_have_count(0)

    # Manager and coach.
    p.fill("#manager-new-name", "Priya Raman"); p.locator("form", has_text="Add the manager").get_by_role("button", name="Add").click()
    expect(p.locator("#staff-h ~ ul")).to_contain_text("Priya Raman")
    p.fill("#coach-new-name", "Coach Kim"); p.locator("form", has_text="Add the coach").get_by_role("button", name="Add").click()
    expect(p.locator("#staff-h ~ ul")).to_contain_text("Coach Kim")
    # Captain.
    p.locator("#captain").select_option(p.locator("#captain option", has_text="Sam Okafor").get_attribute("value"))
    p.locator("form", has=p.locator("#captain")).get_by_role("button", name="Save").click()
    expect(p.get_by_text("Captain saved.")).to_be_visible()
    expect(p.locator("#players-h ~ ul li", has_text="Sam Okafor").get_by_label("Captain")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/roster-team.png", full_page=True)
    no_sideways(p, "roster page")

    # Submitting needs the criteria box ticked.
    p.get_by_role("button", name="Submit roster").click()
    expect(p.get_by_text("Tick the box to confirm")).to_be_visible()
    p.get_by_label("Every player on this roster meets the player criteria above.").check()
    p.get_by_role("button", name="Submit roster").click()
    expect(p.get_by_text(re.compile("^Submitted "))).to_be_visible()
    # Locked for the team: no edit, remove or add.
    p.goto(roster_url)
    expect(p.get_by_role("button", name=re.compile("^Edit "))).to_have_count(0)
    expect(p.get_by_role("button", name=re.compile("^Remove "))).to_have_count(0)
    expect(p.locator("#manager-new-name")).to_have_count(0)
    expect(p.get_by_role("button", name="Submit roster")).to_have_count(0)

    # The host can still change it: edit a number, remove a player, add one. Each is marked.
    login(p, "Dan")
    p.goto(roster_url)
    expect(p.get_by_text("You're the host: you can still change this roster")).to_be_visible()
    p.get_by_role("button", name="Edit Sam Okafor").click()
    edit_form = p.locator("form", has_text="This will show on the roster as changed by the host.")
    edit_form.get_by_label("Number").fill("10")
    edit_form.get_by_role("button", name="Save").click()
    sam = p.locator("#players-h ~ ul li", has_text="Sam Okafor")
    expect(sam).to_contain_text("Changed by host"); expect(sam).to_contain_text("was #99")
    second = p.locator("#players-h ~ ul li").filter(has_not_text="Sam Okafor").first
    gone = second.locator("span.font-semibold").first.inner_text()
    second.get_by_role("button", name=re.compile("^Remove ")).click()
    expect(p.locator("#players-h ~ ul li", has_text=gone)).to_contain_text("Removed by host")
    p.fill("#player-new-jersey", "7"); p.fill("#player-new-name", "Late Signing")
    p.get_by_role("button", name="Add", exact=True).last.click()
    expect(p.locator("#players-h ~ ul li", has_text="Late Signing")).to_contain_text("Added by host")
    # The host moves the captaincy: both players show the change.
    p.locator("#captain").select_option(p.locator("#captain option", has_text="Late Signing").get_attribute("value"))
    p.locator("form", has=p.locator("#captain")).get_by_role("button", name="Save").click()
    expect(p.locator("#players-h ~ ul li", has_text="Sam Okafor")).to_contain_text("no longer captain")
    expect(p.locator("#players-h ~ ul li", has_text="Late Signing").get_by_label("Captain")).to_be_visible()

    # The guest team: only the host fills it in.
    p.goto(f"{BASE}/tournaments/{tid}/teams")
    rosters = p.locator("#rosters")
    expect(rosters).to_contain_text("1 of 2 submitted")
    expect(rosters.locator("li", has_text="Kingston Strikers")).to_contain_text("Changed by host (3)")
    # The Strikers' calendar has the tournament on it.
    login(p, "Priya")
    p.goto(f"{BASE}/teams"); p.get_by_role("link", name=re.compile("Kingston Strikers")).first.click(); p.wait_for_url(re.compile(r"/t/[^/]+/"))
    team_url = re.search(r"(/t/[^/]+)/", p.url).group(1)
    p.goto(f"{BASE}{team_url}/schedule")
    expect(p.get_by_text("Roster Cup").first).to_be_visible()
    login(p, "Dan")
    p.goto(f"{BASE}/tournaments/{tid}/teams")
    p.locator("#rosters").get_by_role("link", name=re.compile("Bath Road Rovers")).click()
    p.wait_for_url(re.compile(r"/teams/[^/?]+$"))
    expect(p.get_by_text("Submit it for this team once it's complete.")).to_be_visible()

    # Teammates see the roster and the marks; they can't change anything.
    login(p, "Rahul")
    p.goto(roster_url)
    expect(p.get_by_text("The host changed this roster after it was submitted (3 changes)")).to_be_visible()
    expect(p.locator("#players-h ~ ul li", has_text="Sam Okafor")).to_contain_text("was #99")
    expect(p.get_by_role("button", name=re.compile("^Edit "))).to_have_count(0)
    expect(p.get_by_text("Captain: Late Signing")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/roster-marked.png", full_page=True)
    b.close()

real = [e for e in errors if "#418" not in e]
assert not real, real
print("tournament_rosters: all checks pass")
