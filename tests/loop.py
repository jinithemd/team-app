import re, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
OUT = "/home/claude/team-app/replica/clone-screens"
errors = []

def watch(page, who):
    page.on("console", lambda m: errors.append(f"{who} console: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
    page.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))

def shot(page, name):
    page.wait_for_load_state("networkidle")
    page.locator('[aria-label="Loading"]').first.wait_for(state="detached", timeout=10000) if page.locator('[aria-label="Loading"]').count() else None
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)

def step(msg): print("✓", msg, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    phone = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    coach = b.new_context(**phone); c = coach.new_page(); watch(c, "coach")
    parent = b.new_context(**phone); par = parent.new_page(); watch(par, "parent")

    # S01 sign up as a new coach
    c.goto(f"{BASE}/login"); shot(c, "S01-login")
    c.fill("#firstName", "Jordan"); c.fill("#lastName", "Lee"); c.fill("#email", "jordan.coach@example.com")
    c.click("text=Create account"); c.wait_for_url(f"{BASE}/")
    expect(c.get_by_text("You're not on a team yet")).to_be_visible(); shot(c, "S02-home-empty"); step("new coach signs up, sees empty home")

    # S05 create team with an orange colour
    c.goto(f"{BASE}/teams/new")
    c.fill("#name", "Riverside U11 Rockets")
    c.get_by_role("radio", name="Orange").first.click()
    shot(c, "S05-create-team")
    c.click("text=Create team"); c.wait_for_url(re.compile(r"/roster\?created=1"))
    expect(c.get_by_text("Nobody's on the roster yet")).to_be_visible(); shot(c, "S12-roster-empty"); step("team created with colour, lands on empty roster")

    team_id = re.search(r"/t/([^/]+)/", c.url).group(1)

    # S13 paste two players
    c.goto(f"{BASE}/t/{team_id}/roster/add")
    c.click("text=Paste a whole list instead")
    c.fill("#paste", "Kai Morgan, morgan.family@example.com, 9\nLila Osei, osei.family@example.com, 14, Goalkeeper")
    c.get_by_role("button", name=re.compile("Add 2 to the list")).click()
    expect(c.locator("input[name='1.firstName']")).to_have_value("Lila")
    shot(c, "S13-add-players")
    c.get_by_role("button", name="Send 2 invites").click(); c.wait_for_url(re.compile(r"invited=2"))
    expect(c.get_by_text("Invite sent").first).to_be_visible(); shot(c, "S12-roster-invited"); step("pasted list of 2 players, invites pending")

    # parent opens invite email from sample inbox, joins
    par.goto(f"{BASE}/dev/outbox")
    inv = par.locator("li", has_text="morgan.family@example.com").first
    inv.get_by_role("link", name="Join the team").click()
    par.wait_for_url(re.compile(r"/invite/")); shot(par, "invite-landing")
    par.fill("#firstName", "Dana"); par.fill("#lastName", "Morgan"); par.get_by_role("button", name="Join the team").click()
    par.wait_for_url(re.compile(r"/schedule\?joined=1"))
    expect(par.get_by_text("No games or practices yet")).to_be_visible(); step("parent joins from email invite, sees empty schedule")

    # S09 coach adds a game, notify on
    c.goto(f"{BASE}/t/{team_id}/e/new"); shot(c, "S09-new-event")
    c.click("text=Add game"); expect(c.get_by_text("Add who you're playing.")).to_be_visible(); step("validation: game needs an opponent")
    c.fill("#opponent", "Cataraqui Cobras")
    c.fill("#date", "2026-11-07"); c.fill("#startTime", "10:00")
    c.fill("#locationText", "Caraco Park, Field 1")
    c.click("text=Add game"); c.wait_for_url(re.compile(r"/e/[^/]+\?created=1"))
    event_url = c.url.split("?")[0]
    expect(c.get_by_text("0 going")).to_be_visible(); step("coach adds game; 0 going so far")
    expect(c.get_by_text("10:00 am – 11:30 am", exact=False)).to_be_visible(); step("end time defaulted to 90 min, shown in Toronto time")

    # parent answers Going from the email button
    par.goto(f"{BASE}/dev/outbox")
    mail = par.locator("li", has_text="Cataraqui Cobras").filter(has_text="morgan.family@example.com").first
    mail.get_by_role("link", name="Going", exact=True).click()
    expect(par.get_by_text("Kai is going")).to_be_visible(); shot(par, "email-rsvp-landing"); step("parent taps Going in email: one-tap answer, no sign-in")

    # coach sees it
    c.goto(event_url); expect(c.get_by_text("1 going")).to_be_visible(); step("coach sees 1 going")
    c.goto(event_url + "/rsvps"); expect(c.get_by_text("Kai Morgan")).to_be_visible(); shot(c, "S10-availability"); step("availability list shows Kai under Going")

    # parent changes answer in-app with keyboard, adds note
    par.goto(event_url)
    par.get_by_role("button", name="Maybe", exact=True).focus(); par.keyboard.press("Enter")
    expect(par.get_by_text("Saved")).to_be_visible()
    par.get_by_role("button", name="+ Add a note for the coach").click()
    par.get_by_placeholder("e.g. Might be 10 minutes late").fill("Has a dentist appointment at 9")
    par.keyboard.press("Enter"); expect(par.get_by_text("Note sent to the coach")).to_be_visible()
    shot(par, "S08-event-parent"); step("parent switches to Maybe with keyboard and adds a private note")
    c.goto(event_url + "/rsvps"); expect(c.get_by_text("Has a dentist appointment at 9")).to_be_visible(); step("coach sees the note")

    # permission: parent can't add events
    par.goto(f"{BASE}/t/{team_id}/e/new"); expect(par.get_by_text("Only staff can add events")).to_be_visible(); step("parent blocked from adding events")

    # coach cancels the game
    c.goto(event_url); c.get_by_role("button", name="Cancel event").click()
    c.fill("#reason", "Field flooded"); c.click("text=Cancel and tell the team")
    expect(c.get_by_text("Marked cancelled")).to_be_visible(); c.reload()
    expect(c.get_by_text("Cancelled: Field flooded")).to_be_visible(); step("coach cancels with a reason")
    par.goto(f"{BASE}/t/{team_id}/schedule"); expect(par.get_by_text("Field flooded")).to_be_visible(); step("parent sees it cancelled on the schedule")

    # seeded accounts: multi-kid parent, team colours, screens
    demo = b.new_context(**phone); d = demo.new_page(); watch(d, "anita")
    d.goto(f"{BASE}/login"); d.get_by_role("button", name=re.compile("Anita Nair")).click(); d.wait_for_url(f"{BASE}/")
    shot(d, "S02-home"); step("Anita (2 kids, 2 teams) home")
    d.goto(f"{BASE}/rsvps"); shot(d, "S11-my-rsvps")
    d.goto(f"{BASE}/calendar"); shot(d, "S18-calendar")
    d.goto(f"{BASE}/teams"); shot(d, "S03-teams")
    d.goto(f"{BASE}/t/t-strikers/schedule"); shot(d, "S07-schedule")
    d.goto(f"{BASE}/t/t-strikers/schedule?view=month"); shot(d, "S07-schedule-month")
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(d, "S08-event")
    d.goto(f"{BASE}/t/t-strikers/roster"); shot(d, "S12-roster")
    d.goto(f"{BASE}/t/t-comets/schedule"); shot(d, "S07-schedule-comets")
    d.goto(f"{BASE}/account"); shot(d, "S23-account")
    # another family's notes are hidden from Anita
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1/rsvps")
    assert d.get_by_text("Away at a family wedding").count() == 0; step("other families' notes hidden from parents")
    # dark mode
    d.goto(f"{BASE}/account"); d.get_by_role("button", name="Dark").click(); d.wait_for_timeout(500)
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(d, "S08-event-dark")
    d.goto(f"{BASE}/"); shot(d, "S02-home-dark"); step("dark mode via account setting")

    # desktop
    desk = b.new_context(viewport={"width": 1440, "height": 900}); k = desk.new_page(); watch(k, "priya")
    k.goto(f"{BASE}/login"); k.get_by_role("button", name=re.compile("Priya Raman")).click(); k.wait_for_url(f"{BASE}/")
    shot(k, "S02-home-1440")
    k.goto(f"{BASE}/t/t-strikers/schedule"); shot(k, "S07-schedule-1440")
    k.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(k, "S08-event-staff-1440")
    k.goto(f"{BASE}/t/t-strikers/e/e-s-g1/rsvps"); shot(k, "S10-availability-1440")
    assert k.get_by_text("Away at a family wedding").count() == 1; step("coach sees notes")
    k.goto(f"{BASE}/teams/new"); k.fill("#name", "Lemon Test FC"); k.get_by_role("radio", name="Yellow").first.click(); shot(k, "S05-create-team-yellow-1440")

    # horizontal overflow check on all phone screenshots' pages
    for path in ["/", "/rsvps", "/calendar", "/teams", "/t/t-strikers/schedule", "/t/t-strikers/e/e-s-g1", "/t/t-strikers/roster", "/account"]:
        d.goto(BASE + path)
        sw = d.evaluate("document.documentElement.scrollWidth")
        if sw > 390: errors.append(f"overflow {path}: {sw}px")
    step("no sideways scroll at 390px") if not any("overflow" in e for e in errors) else None
    b.close()

print("\nERRORS:" if errors else "\nno console errors")
for e in errors: print(" ", e)
sys.exit(1 if errors else 0)
