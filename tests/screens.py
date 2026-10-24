"""Every screen added in the front-end pass: chat, messages, notifications, calendar feed,
exports, club pages, join requests, find a team. Plus a sweep of every route at phone width
for console errors and sideways scroll. Run against a fresh server (sample data resets)."""
import re, sys, urllib.request
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; OUT = "/home/claude/team-app/replica/clone-screens"
errors = []
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
def ctx(b, dark=False):
    return b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="dark" if dark else "light")
def login(b, name, dark=False):
    c = ctx(b, dark); p = c.new_page(); watch(p, name)
    p.goto(f"{BASE}/login"); p.get_by_role("button", name=re.compile(name)).click(); p.wait_for_url(f"{BASE}/")
    return p
def shot(p, name): p.wait_for_timeout(250); p.screenshot(path=f"{OUT}/{name}.png", full_page=True)
def step(m): print("✓", m, flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- chat ---------------------------------------------------------------
    r = login(b, "Rahul Menon")
    r.goto(f"{BASE}/chat"); expect(r.get_by_text("Kingston Strikers").first).to_be_visible()
    assert r.get_by_role("link", name=re.compile("· captains")).count() == 0; step("Rahul's chat list has no captains room")
    shot(r, "S16-chat-list")
    r.goto(f"{BASE}/t/t-strikers/chat")
    expect(r.get_by_role("region", name="Pinned")).to_be_visible(); step("pinned message shows")
    poll = r.get_by_role("group", name=re.compile("Poll: End-of-season"))
    poll.get_by_role("button", name=re.compile("Curry night")).click(); r.wait_for_timeout(600)
    expect(poll.get_by_role("button", name=re.compile("Curry night"))).to_have_attribute("aria-pressed", "true"); step("votes in a chat poll")
    r.get_by_label("Message", exact=True).fill("Count me in for Tuesday"); r.get_by_role("button", name="Send").click()
    expect(r.get_by_text("Count me in for Tuesday")).to_be_visible(); step("sends a chat message")
    r.get_by_role("button", name="More for Jordan's message").click(); r.get_by_role("button", name="Reply").click()
    expect(r.get_by_text("Replying to Jordan")).to_be_visible()
    r.get_by_label("Message", exact=True).fill("It really was"); r.keyboard.press("Enter")
    expect(r.locator("li", has_text="It really was").get_by_text("What a header")).to_be_visible(); step("replies to a message")
    r.get_by_role("button", name="More for Sam's message").first.click(); r.get_by_role("button", name="React 🔥").click()
    expect(r.get_by_role("button", name=re.compile("🔥 1, including you"))).to_be_visible(); step("reacts with an emoji")
    shot(r, "S16-chat")
    r.goto(f"{BASE}/t/t-strikers/chat?room=staff")
    expect(r.get_by_text("Captains only")).to_have_count(0); step("player can't open the captains room")

    p = login(b, "Priya Raman")
    p.goto(f"{BASE}/t/t-strikers/chat?room=staff"); expect(p.get_by_text("Only captains, managers and coaches see this chat.")).to_be_visible()
    expect(p.get_by_text("can you take attendance Thursday")).to_be_visible(); shot(p, "S16-chat-staff"); step("captain opens the captains room")

    # ---- messages and notifications -----------------------------------------
    p.goto(f"{BASE}/t/t-strikers/messages/new")
    p.get_by_text("Players", exact=True).click()
    p.fill("#subject", "Kit numbers"); p.fill("#body", "Reply in chat with your shirt size by Friday.")
    p.get_by_role("button", name="Send").click(); p.wait_for_url(re.compile(r"sent="))
    expect(p.get_by_text("Kit numbers")).to_be_visible(); shot(p, "S17-messages"); step("captain sends a message to players")
    r.goto(f"{BASE}/t/t-strikers/messages"); expect(r.get_by_text("Kit numbers")).to_be_visible(); step("player sees it")
    r.goto(f"{BASE}/account/notifications")
    sec = r.get_by_role("region", name="Kingston Strikers")
    sec.get_by_label("Email").uncheck(); sec.get_by_role("button", name="Save").click(); expect(sec.get_by_text("Saved.")).to_be_visible()
    r.reload(); expect(r.get_by_role("region", name="Kingston Strikers").get_by_label("Email")).not_to_be_checked(); shot(r, "S22-notifications"); step("notification settings save per team")

    # ---- calendar feed and exports --------------------------------------------
    r.goto(f"{BASE}/calendar/subscribe")
    url = r.get_by_label("Calendar link").input_value()
    ics = urllib.request.urlopen(url.replace("http://localhost:3000", BASE)).read().decode()
    assert ics.startswith("BEGIN:VCALENDAR") and "Frontenac FC" in ics and "Napanee Rovers" in ics, ics[:300]
    step("calendar feed has both teams' events"); shot(r, "S19-subscribe")
    r.get_by_role("button", name="Reset the link").click(); expect(r.get_by_text("New link ready")).to_be_visible()
    try:
        urllib.request.urlopen(url); errors.append("old calendar link still works after reset")
    except Exception: step("reset link: old one stops working")
    with p.expect_download() as d: p.goto(f"{BASE}/t/t-strikers/roster"); p.get_by_role("link", name="Attendance").click()
    body = open(d.value.path(), encoding="utf-8-sig").read(); assert body.startswith("Player,") and "Rahul Menon" in body; step("attendance exports to CSV")
    resp = r.request.get(f"{BASE}/t/t-strikers/export/players.csv"); assert resp.status == 403; step("players can't export")

    # ---- clubs ----------------------------------------------------------------
    anon = ctx(b).new_page(); watch(anon, "visitor")
    anon.goto(f"{BASE}/c/limestone-city"); expect(anon.get_by_text("5 teams")).to_be_visible()
    expect(anon.get_by_text("Powered by Areno")).to_be_visible(); shot(anon, "club-public"); step("public club page lists 5 teams, signed out")
    anon.get_by_role("link", name="Sign in to join").first.click(); anon.wait_for_url(re.compile(r"/c/limestone-city/login"))
    shot(anon, "club-signin")
    anon.fill("#firstName", "Zoe"); anon.fill("#lastName", "Park"); anon.fill("#email", "zoe.park@example.com"); anon.click("text=Create account")
    anon.wait_for_url(f"{BASE}/c/limestone-city"); step("new player signs up from the club's own sign-in")
    women = anon.locator("li", has_text="Limestone City Women")
    women.get_by_role("button", name="Ask to join").click(); women.locator("textarea").fill("Played at Queen's, any position")
    women.get_by_role("button", name="Send request").click(); expect(women.get_by_text(re.compile("Asked to join"))).to_be_visible(); step("asks to join the Women's team")
    man = ctx(b).new_page(); watch(man, "manifest")
    m = man.request.get(f"{BASE}/c/limestone-city/manifest.webmanifest").json(); assert m["name"] == "Limestone City FC" and m["theme_color"] == "#0F5C3A"; step("club web manifest has the club's name and colour")

    dan = login(b, "Dan Kowalski")
    dan.goto(f"{BASE}/teams"); dan.get_by_role("link", name=re.compile("^Limestone City FC Club owner")).click(); dan.wait_for_url(re.compile(r"/clubs/c-lcfc"))
    expect(dan.get_by_text("join requests")).to_be_visible(); shot(dan, "club-admin"); step("Dan opens club admin from Teams")
    dan.goto(f"{BASE}/t/t-women/roster")
    jr = dan.get_by_role("region", name=re.compile("want to join"))
    expect(jr.get_by_text("Zoe Park")).to_be_visible()
    jr.locator("div", has_text="Zoe Park").get_by_role("button", name="Add to the team").last.click(); dan.wait_for_timeout(800)
    expect(dan.get_by_role("list", name="Players").get_by_text("Zoe Park")).to_be_visible(); step("club owner approves Zoe")
    anon.goto(f"{BASE}/c/limestone-city"); expect(anon.locator("li", has_text="Limestone City Women").get_by_text("You're on this team")).to_be_visible(); step("Zoe is on the team")

    dan.goto(f"{BASE}/clubs/c-lcfc/settings")
    dan.get_by_role("radio", name="Navy").first.click(); dan.get_by_role("button", name="Save").first.click()
    expect(dan.get_by_text("Every club team now shows the new look")).to_be_visible(); shot(dan, "club-settings")
    dan.goto(f"{BASE}/t/t-reserves/schedule"); bg = dan.locator("header").first.evaluate("e => getComputedStyle(e).backgroundColor")
    assert bg == "rgb(11, 31, 75)", bg; step("club colour change reaches every club team")
    dan.goto(f"{BASE}/clubs/c-lcfc/settings")
    dan.fill("#admin-email", "mei.lin@example.com"); dan.get_by_role("button", name="Add").click(); expect(dan.get_by_text("Added. They got an email.")).to_be_visible(); step("owner adds a club admin")
    dan.goto(f"{BASE}/clubs/c-lcfc/stats"); expect(dan.get_by_text("Attendance, last 8 weeks")).to_be_visible(); shot(dan, "club-stats"); step("club stats render")

    # find a team by code
    zoe = anon
    zoe.goto(f"{BASE}/teams/search?q=strikers"); expect(zoe.get_by_text("Kingston Strikers")).to_be_visible(); step("search finds a team by name")
    zoe.fill("#code", "KSTR7A2Q"); zoe.get_by_role("button", name="Join", exact=True).click(); zoe.wait_for_url(re.compile(r"/t/t-strikers/schedule\?joined=1")); step("joins with a team code")

    # ---- sweep every screen at 390px, light and dark -----------------------------
    routes = {
        "Priya Raman": ["/", "/rsvps", "/calendar", "/calendar/subscribe", "/chat", "/teams", "/teams/search", "/teams/new", "/clubs/new", "/account", "/account/notifications", "/availability",
            "/t/t-strikers/schedule", "/t/t-strikers/schedule?view=month", "/t/t-strikers/e/e-s-g1", "/t/t-strikers/e/e-s-g1/rsvps", "/t/t-strikers/e/e-s-g1/attendance",
            "/t/t-strikers/e/e-s-g1/match", "/t/t-strikers/e/e-s-g3/managers", "/t/t-strikers/e/e-s-g3/edit", "/t/t-strikers/e/new", "/t/t-strikers/roster", "/t/t-strikers/roster/add",
            "/t/t-strikers/p/u-rahul", "/t/t-strikers/points", "/t/t-strikers/seasons", "/t/t-strikers/settings", "/t/t-strikers/venues", "/t/t-strikers/dues", "/t/t-strikers/chat",
            "/t/t-strikers/chat?room=staff", "/t/t-strikers/messages", "/t/t-strikers/messages/new", "/t/t-strikers/you"],
        "Rahul Menon": ["/", "/t/t-reserves/e/e-r-g1", "/t/t-reserves/e/e-r-g1/carpool", "/t/t-reserves/dues", "/t/t-strikers/e/e-s-past-1/match", "/t/t-strikers/points"],
        "Dan Kowalski": ["/clubs/c-lcfc", "/clubs/c-lcfc/settings", "/clubs/c-lcfc/stats", "/c/limestone-city", "/t/t-first/roster", "/t/t-first/dues"],
    }
    for dark in (False, True):
        for who, paths in routes.items():
            q = login(b, who, dark)
            for path in paths:
                res = q.goto(BASE + path)
                if res and res.status >= 400: errors.append(f"{who} {path}: HTTP {res.status}")
                sw = q.evaluate("document.documentElement.scrollWidth")
                if sw > 390: errors.append(f"{'dark ' if dark else ''}overflow {path} ({who}): {sw}px")
                if dark and path in ("/t/t-strikers/chat", "/clubs/c-lcfc/stats", "/t/t-reserves/e/e-r-g1/carpool"): shot(q, "dark-" + path.strip("/").replace("/", "-").replace("?", "-"))
    step(f"swept {sum(len(v) for v in routes.values())} screens in light and dark")
    b.close()

print("\nERRORS:" if errors else "\nno console errors, no sideways scroll")
for e in errors: print(" ", e)
sys.exit(1 if errors else 0)
