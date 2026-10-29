# Sample-data build: game sessions. Staff post a drop-in game with spots held for players,
# supporters (followers) get told and book, it fills, the waitlist moves up, and a weekly
# session posts itself.
import re, datetime
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

day = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto")
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(p.url + " " + str(e)[:80]))
    p.on("dialog", lambda d: d.accept())

    # Marcus follows the Strikers as a supporter.
    login(p, "Marcus")
    p.goto(f"{BASE}/f/t-strikers")
    p.get_by_role("button", name="Follow").click()
    expect(p.get_by_role("button", name="Following")).to_be_visible()

    # 1) Priya (Strikers captain) posts a $8 indoor night game: 4 spots, 2 kept for players.
    login(p, "Priya")
    # No separate tab: it's New event → Drop-in, next to Match and Training.
    p.goto(f"{BASE}/t/t-strikers/schedule")
    expect(p.get_by_role("navigation", name="Team sections").get_by_role("link", name="Sessions")).to_have_count(0)
    p.get_by_role("link", name="New event").first.click()
    p.wait_for_url(re.compile(r"/e/new$"))
    p.get_by_role("radio", name="Drop-in").click()
    expect(p.get_by_text("A game anyone can book")).to_be_visible()
    p.fill("#title", "Indoor night game")
    p.fill("#date", day); p.fill("#startTime", "21:00"); p.fill("#endTime", "22:30")
    p.fill("#venueName", "Invista Centre")
    p.fill("#price", "8"); p.fill("#capacity", "4"); p.fill("#memberSpots", "2")
    p.screenshot(path=f"{SHOTS}/session-new.png", full_page=True)
    no_sideways(p, "new session")
    p.get_by_role("button", name="Post drop-in").click()
    p.wait_for_url(re.compile(r"/s/[0-9a-f-]{36}\?posted=1"))
    sid = re.search(r"/s/([0-9a-f-]{36})", p.url).group(1)
    expect(p.get_by_text("Posted. Your players and supporters have been told.")).to_be_visible()
    expect(p.get_by_text("4 of 4 spots left")).to_be_visible()
    expect(p.get_by_text("2 kept for Kingston Strikers players")).to_be_visible()
    # It's on the team's schedule as a Drop-in, opening the session.
    p.goto(f"{BASE}/t/t-strikers/schedule")
    card = p.get_by_role("link", name=re.compile(r"^Indoor night game, Drop-in"))
    expect(card).to_be_visible()
    assert card.get_attribute("href") == f"/s/{sid}"
    # Marcus got told.
    p.goto(f"{BASE}/dev/outbox")
    expect(p.locator("li", has_text="marcus.lee@example.com").filter(has_text="Indoor night game").first).to_be_visible()

    # 2) Marcus (supporter) books from the fan page: 2 open spots, then 1.
    login(p, "Marcus")
    p.goto(f"{BASE}/f/t-strikers")
    ses = p.get_by_role("region", name="Come and play")
    expect(ses).to_contain_text("Indoor night game")
    expect(ses).to_contain_text("2 spots left")
    ses.get_by_role("link", name=re.compile("Indoor night game")).click()
    p.wait_for_url(re.compile(rf"/s/{sid}"))
    expect(p.get_by_text("pay at the door or by e-Transfer")).to_be_visible()
    p.get_by_role("button", name="Book a spot").click()
    expect(p.get_by_text("You're in. See you there!")).to_be_visible()
    expect(p.get_by_text("1 of 4 spots left")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/session-booked.png", full_page=True)
    no_sideways(p, "session page")
    # Home shows it.
    p.goto(f"{BASE}/")
    expect(p.get_by_role("region", name="Games you can join")).to_contain_text("You're in")

    # 3) Dan takes the last open spot; Aisha has to join the waitlist.
    login(p, "Dan")
    p.goto(f"{BASE}/s/{sid}")
    p.get_by_role("button", name="Book a spot").click()
    expect(p.get_by_text("You're in. See you there!")).to_be_visible()
    login(p, "Aisha")
    p.goto(f"{BASE}/s/{sid}")
    expect(p.get_by_text("Full (4 spots)")).to_be_visible()
    p.get_by_role("button", name="Join the waitlist").click()
    expect(p.get_by_text("You're number 1 on the waitlist.")).to_be_visible()

    # 4) A Strikers player still gets one of the kept spots, and it's on his calendar.
    login(p, "Rahul")
    p.goto(f"{BASE}/calendar")
    expect(p.get_by_role("link", name=re.compile(r"^Indoor night game, Drop-in")).first).to_be_visible()
    p.goto(f"{BASE}/s/{sid}")
    expect(p.get_by_text("you can use the spots kept for players")).to_be_visible()
    p.get_by_role("button", name="Book a spot").click()
    expect(p.get_by_text("You're in. See you there!")).to_be_visible()

    # 5) Priya sees everyone, ticks off Marcus's cash, removes Dan: Aisha moves up and is told.
    login(p, "Priya")
    p.goto(f"{BASE}/s/{sid}")
    who = p.get_by_role("region", name="Who's coming")
    expect(who).to_contain_text("3 of 4")
    expect(who.locator("li", has_text="Marcus Lee")).to_contain_text("Supporter")
    expect(who.locator("li", has_text="Rahul Menon")).to_contain_text("Player")
    who.get_by_role("button", name="Mark Marcus Lee as paid cash").click()
    expect(who.get_by_role("button", name="Marcus Lee paid cash. Untick")).to_be_visible()
    who.get_by_role("button", name="Remove Dan Kowalski").click()
    expect(p.get_by_role("region", name="Who's coming").locator("li", has_text="Aisha")).to_be_visible()
    expect(p.get_by_role("region", name="Who's coming")).to_contain_text("1 paid")
    p.screenshot(path=f"{SHOTS}/session-staff.png", full_page=True)
    p.goto(f"{BASE}/dev/outbox")
    expect(p.locator("li", has_text="You're in: Indoor night game").first).to_be_visible()
    login(p, "Aisha")
    p.goto(f"{BASE}/s/{sid}")
    expect(p.get_by_text("You're in. See you there!")).to_be_visible()

    # 6) A weekly session that posts itself. Posting 27 days ahead means the next one is up now.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/e/new")
    p.get_by_role("radio", name="Drop-in").click()
    p.get_by_label("Every week").check()
    p.fill("#title", "Sunday fun game")
    p.select_option("#weekday", "0")
    p.fill("#venueName", "Caraco Park")
    p.fill("#capacity", "20"); p.fill("#memberSpots", "6")
    p.fill("#releaseHours", "24")
    p.fill("#postDaysBefore", "27"); p.fill("#postTime", "09:00")
    p.get_by_role("button", name="Set up weekly drop-in").click()
    p.wait_for_url(re.compile(r"/schedule\?weekly=1"))
    expect(p.get_by_text("Weekly drop-in set up.")).to_be_visible()
    weekly = p.get_by_role("region", name="Drop-ins you've set up")
    expect(weekly).to_contain_text("Sundays 10 am–12 pm · Caraco Park · Free · 20 spots (6 for players)")
    expect(weekly).to_contain_text("posted")
    # Posted weeks are on the schedule like any event.
    expect(p.get_by_role("link", name=re.compile(r"^Sunday fun game, Drop-in")).first).to_be_visible()
    # Skip a week, then pause.
    weekly.get_by_role("button", name=re.compile("^Skip")).nth(1).click()
    expect(p.get_by_role("region", name="Drop-ins you've set up")).to_contain_text("skipped")
    p.get_by_role("region", name="Drop-ins you've set up").get_by_role("button", name="Pause").click()
    expect(p.get_by_role("region", name="Drop-ins you've set up")).to_contain_text("paused")
    p.screenshot(path=f"{SHOTS}/sessions-tab.png", full_page=True)
    no_sideways(p, "sessions tab")

    # 7) Cancelling a session tells everyone booked.
    p.goto(f"{BASE}/s/{sid}")
    p.get_by_role("button", name="Cancel session").click()
    expect(p.get_by_text("This session is cancelled.")).to_be_visible()
    p.goto(f"{BASE}/dev/outbox")
    expect(p.locator("li", has_text="Cancelled: Indoor night game").first).to_be_visible()
    p.goto(f"{BASE}/t/t-strikers/schedule")
    expect(p.get_by_role("link", name=re.compile(r"^Indoor night game, Drop-in.*cancelled"))).to_be_visible()
    b.close()

real = [e for e in errors if "#418" not in e]
assert not real, real
print("sessions: all checks pass")
