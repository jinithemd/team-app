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
    cap = b.new_context(**phone); c = cap.new_page(); watch(c, "founder")
    player = b.new_context(**phone); par = player.new_page(); watch(par, "player")

    # S01 one sign-up for everyone
    c.goto(f"{BASE}/login"); shot(c, "S01-login")
    c.fill("#firstName", "Jin"); c.fill("#lastName", "Varghese"); c.fill("#email", "jin.founder@example.com")
    c.click("text=Create account"); c.wait_for_url(f"{BASE}/")
    expect(c.get_by_text("You're not on a team yet")).to_be_visible(); shot(c, "S02-home-empty"); step("founder signs up once, sees empty home")

    # set up a club: makes you its owner
    c.get_by_role("link", name="Set up a club").click(); c.wait_for_url(f"{BASE}/clubs/new")
    c.click("text=Create club"); expect(c.get_by_text("Give the club a name.")).to_be_visible(); step("validation: club needs a name")
    c.fill("#name", "Riverside FC"); shot(c, "club-new")
    c.click("text=Create club"); c.wait_for_url(re.compile(r"/teams/new\?club="))
    expect(c.get_by_text("Riverside FC is set up and you're its owner")).to_be_visible(); step("club created, founder is owner")

    # create a team inside the club
    expect(c.locator("#clubId")).to_have_value(re.compile(".+"))
    c.fill("#name", "Riverside First Team"); shot(c, "S05-create-team")
    c.click("text=Create team"); c.wait_for_url(re.compile(r"/you\?new=1"))
    expect(c.get_by_text("Step 2 of 3")).to_be_visible()
    expect(c.get_by_role("radio", name="Yes, I play")).to_have_attribute("aria-checked", "true"); step("Your part step opens, 'I play' preselected")

    # player + captain + manager
    c.fill("#jersey", "9"); c.fill("#position", "Forward")
    c.locator("label", has_text="Manager").click()
    prev = c.get_by_role("region", name="How you'll show on the roster")
    for hat in ["Player #9", "Captain", "Manager", "Club owner"]:
        expect(prev.get_by_text(hat, exact=True)).to_be_visible()
    shot(c, "your-part"); step("preview shows Player #9, Captain, Manager, Club owner")
    c.click("text=Next: add players"); c.wait_for_url(re.compile(r"/roster\?created=1"))
    me = c.locator("li", has_text="(you)")
    for hat in ["Captain", "Manager", "Club owner"]:
        expect(me.get_by_text(hat, exact=True)).to_be_visible()
    expect(c.get_by_text("1 player")).to_be_visible(); shot(c, "S12-roster-me"); step("founder is on the roster once, with every hat")

    team_id = re.search(r"/t/([^/]+)/", c.url).group(1)

    # the team header shows the hats too
    hdr = c.locator("header").first
    expect(hdr.get_by_text("Player #9", exact=True)).to_be_visible(); step("team header shows your roles")

    # S13 paste two players, give one a role
    c.goto(f"{BASE}/t/{team_id}/roster/add")
    c.click("text=Paste a whole list instead")
    c.fill("#paste", "Kai Morgan, kai.morgan@example.com, 14\nLila Osei, lila.osei@example.com, 1, Goalkeeper")
    c.get_by_role("button", name=re.compile("Add 2 to the list")).click()
    expect(c.locator("input[name='1.firstName']")).to_have_value("Lila")
    c.locator("li", has_text="Person 2").locator("label", has_text="Vice captain").click()
    shot(c, "S13-add-players")
    c.get_by_role("button", name="Send 2 invites").click(); c.wait_for_url(re.compile(r"invited=2"))
    expect(c.get_by_text("Invite sent").first).to_be_visible()
    expect(c.locator("li", has_text="Lila Osei").get_by_text("Vice captain", exact=True)).to_be_visible()
    shot(c, "S12-roster-invited"); step("pasted 2 players, Lila invited as vice captain")

    # player opens the invite from the sample inbox and joins
    par.goto(f"{BASE}/dev/outbox")
    inv = par.locator("li", has_text="kai.morgan@example.com").first
    inv.get_by_role("link", name="Join the team").click()
    par.wait_for_url(re.compile(r"/invite/")); expect(par.get_by_text("Kai, you're on the roster as player #14")).to_be_visible(); shot(par, "invite-landing")
    par.fill("#firstName", "Kai"); par.fill("#lastName", "Morgan"); par.get_by_role("button", name="Join the team").click()
    par.wait_for_url(re.compile(r"/schedule\?joined=1"))
    expect(par.get_by_text("No games or practices yet")).to_be_visible(); step("player joins from the email invite")

    # S09 founder adds a match
    c.goto(f"{BASE}/t/{team_id}/e/new"); shot(c, "S09-new-event")
    c.click("text=Add game"); expect(c.get_by_text("Add who you're playing.")).to_be_visible(); step("validation: match needs an opponent")
    c.fill("#opponent", "Cataraqui Cobras")
    c.fill("#date", "2026-11-07"); c.fill("#startTime", "10:00")
    c.fill("#locationText", "Caraco Park, Field 1")
    c.click("text=Add game"); c.wait_for_url(re.compile(r"/e/[^/]+\?created=1"))
    event_url = c.url.split("?")[0]
    expect(c.get_by_text("0 going")).to_be_visible(); step("founder adds a match; 0 going so far")

    # the founder plays too, so they're asked as well
    expect(c.get_by_role("heading", name="Are you in?")).to_be_visible()
    c.get_by_role("button", name="Going", exact=True).click(); expect(c.get_by_text("Saved")).to_be_visible()
    c.reload(); expect(c.get_by_text("1 going")).to_be_visible(); step("playing captain answers for themselves on the same screen as the captain tools")
    expect(c.get_by_role("button", name="Cancel event")).to_be_visible()

    # player answers from the email button
    par.goto(f"{BASE}/dev/outbox")
    mail = par.locator("li", has_text="Cataraqui Cobras").filter(has_text="kai.morgan@example.com").first
    mail.get_by_role("link", name="Going", exact=True).click()
    expect(par.get_by_text("You're in, Kai")).to_be_visible(); shot(par, "email-rsvp-landing"); step("player taps Going in the email, no sign-in")
    c.goto(event_url); expect(c.get_by_text("2 going")).to_be_visible(); step("founder sees 2 going")

    # player adds a note; founder sees it
    par.goto(event_url)
    par.get_by_role("button", name="Maybe", exact=True).focus(); par.keyboard.press("Enter")
    expect(par.get_by_text("Saved")).to_be_visible()
    par.get_by_role("button", name="+ Add a note for your captains").click()
    par.get_by_placeholder("e.g. Might be 10 minutes late").fill("Working till 9, might be late")
    par.keyboard.press("Enter"); expect(par.get_by_text("Note sent to your captains")).to_be_visible()
    shot(par, "S08-event-player"); step("player switches to Maybe with the keyboard and adds a note")
    c.goto(event_url + "/rsvps"); expect(c.get_by_text("Working till 9, might be late")).to_be_visible(); shot(c, "S10-availability"); step("founder sees the note")

    # permissions: a plain player can't add events or give themself roles
    par.goto(f"{BASE}/t/{team_id}/e/new"); expect(par.get_by_text("Only captains and managers can add events")).to_be_visible(); step("player blocked from adding events")
    par.goto(f"{BASE}/t/{team_id}/you"); expect(par.get_by_text("Only someone who manages permissions can change roles")).to_be_visible()
    expect(par.locator("input[value='captain']")).to_be_disabled(); step("player can't make themself captain")
    par.goto(f"{BASE}/account"); expect(par.locator("li", has_text="Riverside First Team").get_by_text("Player #14", exact=True)).to_be_visible(); step("player's account lists Player #14")

    # founder cancels
    c.goto(event_url); c.get_by_role("button", name="Cancel event").click()
    c.fill("#reason", "Field flooded"); c.click("text=Cancel and tell the team")
    expect(c.get_by_text("Marked cancelled")).to_be_visible(); c.reload()
    expect(c.get_by_text("Cancelled: Field flooded")).to_be_visible(); step("founder cancels with a reason")
    par.goto(f"{BASE}/t/{team_id}/schedule"); expect(par.get_by_text("Field flooded")).to_be_visible(); step("player sees it cancelled")

    # founder's account lists every hat
    c.goto(f"{BASE}/account")
    expect(c.locator("li", has_text="Riverside FC").get_by_text("Club owner", exact=True)).to_be_visible()
    row = c.locator("li", has_text="Riverside First Team")
    for hat in ["Player #9", "Captain", "Manager"]:
        expect(row.get_by_text(hat, exact=True)).to_be_visible()
    shot(c, "S23-account-founder"); step("founder's account: Club owner, and Player #9 + Captain + Manager")

    # seeded accounts
    demo = b.new_context(**phone); d = demo.new_page(); watch(d, "rahul")
    d.goto(f"{BASE}/login"); d.get_by_role("button", name=re.compile("Rahul Menon")).click(); d.wait_for_url(f"{BASE}/")
    shot(d, "S02-home"); step("Rahul (2 teams) home")
    d.goto(f"{BASE}/rsvps"); shot(d, "S11-my-rsvps")
    d.goto(f"{BASE}/calendar"); shot(d, "S18-calendar")
    d.goto(f"{BASE}/calendar?team=t-reserves"); expect(d.get_by_text("Napanee Rovers").first).to_be_visible()
    assert d.get_by_text("Frontenac FC").count() == 0; step("calendar filters by team")
    d.goto(f"{BASE}/teams"); shot(d, "S03-teams")
    d.goto(f"{BASE}/t/t-strikers/schedule"); shot(d, "S07-schedule")
    d.goto(f"{BASE}/t/t-strikers/schedule?view=month"); shot(d, "S07-schedule-month")
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(d, "S08-event")
    d.goto(f"{BASE}/t/t-strikers/roster"); shot(d, "S12-roster")
    d.goto(f"{BASE}/account"); shot(d, "S23-account")
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1/rsvps")
    assert d.get_by_text("Away at a wedding").count() == 0; step("teammates' notes hidden from players")
    d.goto(f"{BASE}/account"); d.get_by_role("button", name="Dark").click(); d.wait_for_timeout(500)
    d.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(d, "S08-event-dark")
    d.goto(f"{BASE}/"); shot(d, "S02-home-dark"); step("dark mode via account setting")

    # Dan: club owner who plays, captains and manages the First Team
    dan = b.new_context(**phone).new_page(); watch(dan, "dan")
    dan.goto(f"{BASE}/login"); dan.get_by_role("button", name=re.compile("Dan Kowalski")).click(); dan.wait_for_url(f"{BASE}/")
    dan.goto(f"{BASE}/t/t-reserves/roster"); expect(dan.get_by_text("Marcus Lee")).to_be_visible(); step("club owner sees a club team he isn't on")
    dan.goto(f"{BASE}/t/t-first/roster"); shot(dan, "S12-roster-dan")
    dan.goto(f"{BASE}/t/t-first/e/e-f-g1"); expect(dan.get_by_role("heading", name="Are you in?")).to_be_visible(); step("Dan is asked to answer as a player on his own team")

    # several managers and coaches
    dan.goto(f"{BASE}/t/t-first/roster")
    dan.get_by_role("link", name=re.compile("Dev Kapoor")).click(); dan.wait_for_url(re.compile(r"/roster/r-"))
    dan.locator("label", has_text="Manager").click()
    expect(dan.get_by_label("Add and change matches")).to_be_checked(); step("picking Manager fills in what managers can do")
    shot(dan, "S15-edit-roles")
    dan.get_by_role("button", name="Save").click(); dan.wait_for_url(re.compile(r"saved=member"))
    expect(dan.get_by_text("Roles saved.")).to_be_visible()
    dan.get_by_role("link", name=re.compile("Owen Park")).click(); dan.wait_for_url(re.compile(r"/roster/r-"))
    dan.locator("label", has_text="Coach").click(); dan.get_by_role("button", name="Save").click(); dan.wait_for_url(re.compile(r"saved=member"))
    dan.goto(f"{BASE}/t/t-first/roster/add")
    dan.fill("input[name='0.firstName']", "Sara"); dan.fill("input[name='0.lastName']", "Ito"); dan.fill("input[name='0.email']", "sara.ito@example.com")
    dan.get_by_label("Plays on the team").uncheck()
    dan.locator("li", has_text="Person 1").locator("label", has_text="Coach").click()
    dan.get_by_role("button", name="Send 1 invite").click(); dan.wait_for_url(re.compile(r"invited=1"))
    expect(dan.get_by_text("1 captain · 1 vice captain · 2 managers · 2 coaches")).to_be_visible()
    expect(dan.get_by_role("region", name="Running the team, not playing").get_by_text("Sara Ito")).to_be_visible()
    shot(dan, "S12-roster-staff"); step("First Team now has 2 managers and 2 coaches, one coach not playing")

    # desktop
    desk = b.new_context(viewport={"width": 1440, "height": 900}); k = desk.new_page(); watch(k, "priya")
    k.goto(f"{BASE}/login"); k.get_by_role("button", name=re.compile("Priya Raman")).click(); k.wait_for_url(f"{BASE}/")
    shot(k, "S02-home-1440")
    k.goto(f"{BASE}/t/t-strikers/schedule"); shot(k, "S07-schedule-1440")
    k.goto(f"{BASE}/t/t-strikers/e/e-s-g1"); shot(k, "S08-event-staff-1440")
    k.goto(f"{BASE}/t/t-strikers/e/e-s-g1/rsvps"); shot(k, "S10-availability-1440")
    assert k.get_by_text("Away at a wedding").count() == 1; step("captain sees notes")

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
