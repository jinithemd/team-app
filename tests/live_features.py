"""Live build, every feature beyond the core loop, against the local Supabase stand-in.
Run tests/localstack/up.sh first, then the live build on :3000. Each section runs on its own
and reports; one failing doesn't stop the rest."""
import re, sys, json, html, time, subprocess, datetime, zoneinfo, traceback, urllib.request
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; MAIL = "/var/tmp/sbstack/mail.jsonl"; OUT = "/home/claude/team-app/replica/clone-screens"
TZ = zoneinfo.ZoneInfo("America/Toronto")
errors, failed = [], []

def sql(q):
    return subprocess.check_output(["psql", "-h", "/var/tmp/pgtest", "-p", "5499", "-U", "postgres", "-d", "sb", "-Atc", q]).decode().strip()
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror at {p.url}: {str(e)[:120]}"))
def step(m): print("✓", m, flush=True)
def settle(p):
    try: p.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
def link_for(email, n_before=0):
    for _ in range(60):
        try: mails = [json.loads(l) for l in open(MAIL) if l.strip()]
        except FileNotFoundError: mails = []
        mine = [m for m in mails if email in " ".join(m["to"])]
        if len(mine) > n_before:
            hit = re.search(r'href="([^"]+/verify\?[^"]+)"', mine[-1]["body"])
            if hit: return html.unescape(hit.group(1))
        time.sleep(0.25)
    raise AssertionError(f"no sign-in email for {email}")
def mail_count(email):
    try: return sum(1 for l in open(MAIL) if email in l)
    except FileNotFoundError: return 0
def sign_up(p, first, last, email, next_url=None):
    p.goto(f"{BASE}/login" + (f"?next={next_url}" if next_url else "")); settle(p)
    n = mail_count(email)
    p.fill("#firstName", first); p.fill("#lastName", last); p.fill("#email", email)
    p.check("#agree"); p.get_by_role("button", name="Create account").click(); expect(p.get_by_text("Check your email")).to_be_visible()
    p.goto(link_for(email, n)); settle(p)
def section(name, fn):
    try:
        fn(); print(f"== {name}: ok", flush=True)
    except Exception as e:
        failed.append(name); print(f"== {name}: FAILED\n   {str(e).splitlines()[0][:300]}", flush=True)
        for line in traceback.format_exc().splitlines():
            if "live_features.py" in line: print("   ", line.strip())

with sync_playwright() as pw:
    b = pw.chromium.launch()
    def ctx(**kw): return b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, **kw)
    c = ctx().new_page(); watch(c, "jin")
    k_ctx = ctx(geolocation={"latitude": 44.2312, "longitude": -76.4860, "accuracy": 15}, permissions=["geolocation"]); k = k_ctx.new_page(); watch(k, "kai")

    # --- setup: Jin starts a team, Kai joins by link --------------------------------------
    sign_up(c, "Jin", "Varghese", "jin@example.com")
    c.goto(f"{BASE}/teams/new"); settle(c); c.fill("#name", "Riverside First Team"); c.click("text=Create team"); c.wait_for_url(re.compile(r"/you\?new=1"))
    settle(c); c.fill("#jersey", "9"); c.click("text=Next: add players"); c.wait_for_url(re.compile(r"/roster\?created=1"))
    TEAM = re.search(r"/t/([^/]+)/", c.url).group(1)
    c.goto(f"{BASE}/t/{TEAM}/roster/add"); link = c.get_by_role("textbox", name="Invite link").input_value()
    sign_up(k, "Kai", "Morgan", "kai@example.com", next_url=link.replace(BASE, ""))
    k.goto(link); settle(k); k.get_by_role("button", name="Join Riverside First Team").click(); k.wait_for_url(re.compile(r"/schedule\?joined=1"))
    JIN = sql("select id from profiles where email='jin@example.com'"); KAI = sql("select id from profiles where email='kai@example.com'")
    # Preconditions set straight in the database: points and check-in on, a pinned venue, a match today
    # starting now (for check-in) and an away match next week (for carpools and email answers).
    sql(f"update teams set points_enabled = true, geo_checkin_enabled = true where id = '{TEAM}'")
    VEN = sql(f"insert into venues (team_id, name, lat, lng, check_in_radius_m) values ('{TEAM}', 'Invista Centre', 44.25395, -76.57315, 150) returning id").splitlines()[0]
    SEASON = sql(f"select id from seasons where team_id = '{TEAM}' limit 1")
    NOW_EV = sql(f"insert into events (team_id, season_id, type, start_at, end_at, tz, venue_id, location_text, created_by) values ('{TEAM}', '{SEASON}', 'training', now() - interval '5 minutes', now() + interval '85 minutes', 'America/Toronto', '{VEN}', 'Invista Centre', '{JIN}') returning id").splitlines()[0]
    AWAY = sql(f"insert into events (team_id, season_id, type, start_at, end_at, tz, opponent, home_away, location_text, created_by) values ('{TEAM}', '{SEASON}', 'match', now() + interval '6 days', now() + interval '6 days 2 hours', 'America/Toronto', 'Napanee Rovers', 'away', 'Napanee', '{JIN}') returning id").splitlines()[0]
    step("setup: team, Kai joined, venue, two events")

    def chat():
        c.goto(f"{BASE}/t/{TEAM}/chat"); settle(c)
        c.get_by_label("Message", exact=True).fill("Training moved to Invista tonight"); c.keyboard.press("Enter")
        expect(c.get_by_text("Training moved to Invista tonight")).to_be_visible(); step("Jin posts in team chat")
        k.goto(f"{BASE}/t/{TEAM}/chat"); settle(k); expect(k.get_by_text("Training moved to Invista tonight")).to_be_visible(); step("Kai reads it")
        k.get_by_label("Message", exact=True).fill("On my way"); k.keyboard.press("Enter"); expect(k.get_by_text("On my way")).to_be_visible(); settle(k); k.wait_for_timeout(500)
        c.reload(); expect(c.get_by_text("On my way")).to_be_visible(); step("Kai replies; Jin sees it")
        c.get_by_role("button", name="Start a poll").click(); c.get_by_label("Poll question").fill("Kit colour Saturday?")
        opts = c.locator("input[placeholder^='Option']")
        opts.nth(0).fill("Home"); opts.nth(1).fill("Away")
        c.get_by_role("button", name=re.compile("^(Post poll|Send poll|Post)$")).click(); expect(c.get_by_text("Kit colour Saturday?")).to_be_visible(); step("Jin posts a poll")
        k.reload(); settle(k); k.get_by_role("button", name=re.compile("^Home")).first.click(); k.wait_for_timeout(800)
        assert sql("select count(*) from poll_votes") == "1"; step("Kai votes in the poll")
    section("chat", chat)

    def messages():
        sql(f"update roster_members set permissions = array_append(permissions, 'messages') where team_id='{TEAM}' and user_id='{JIN}' and not 'messages' = any(permissions)")
        c.goto(f"{BASE}/t/{TEAM}/messages/new"); settle(c)
        c.fill("#subject", "Kit order closes Friday"); c.fill("#body", "Sizes to me by Friday please.")
        c.get_by_role("button", name=re.compile("^Send")).click(); c.wait_for_url(re.compile(r"/messages\?sent="))
        step("Jin sends a team message")
        k.goto(f"{BASE}/t/{TEAM}/messages"); expect(k.get_by_text("Kit order closes Friday")).to_be_visible(); step("Kai reads it")
        assert int(sql("select count(*) from outbox where payload->>'subject' like '%Kit order closes Friday%'")) >= 1; step("emails queued")
    section("team messages", messages)

    def dues():
        c.goto(f"{BASE}/t/{TEAM}/dues"); settle(c); c.get_by_role("button", name="Add a fee").click()
        c.fill("input[name=name]", "Season fee"); c.fill("input[name=amount]", "120")
        c.get_by_role("button", name="Add fee").click(); expect(c.get_by_text("$120").first).to_be_visible(); settle(c)
        assert sql("select count(*) from dues") == "2"; step("Jin adds a $120 season fee; both players owe it")
        k.goto(f"{BASE}/t/{TEAM}/dues"); expect(k.get_by_text("Your dues")).to_be_visible()
        k.get_by_role("button", name="I've paid").click(); expect(k.get_by_text("waiting for the treasurer to confirm")).to_be_visible(); settle(k)
        assert sql("select count(*) from payments") == "1"; step("Kai reports paying")
        c.reload(); c.get_by_role("button", name="Confirm").first.click(); c.wait_for_timeout(1000)
        assert sql("select count(*) from payments where verified_by is not null") == "1"; step("Jin confirms it")
    section("dues", dues)

    def carpool():
        k.goto(f"{BASE}/t/{TEAM}/e/{AWAY}/carpool"); settle(k); k.get_by_role("button", name="I'm driving").click()
        k.fill("#seats", "3"); k.fill("#leavesAt", "08:45"); k.fill("#from", "Club car park")
        k.get_by_role("button", name="Offer seats").click(); expect(k.get_by_text("Club car park").first).to_be_visible(); step("Kai offers 3 seats")
        c.goto(f"{BASE}/t/{TEAM}/e/{AWAY}/carpool"); settle(c)
        c.locator("li", has_text="Kai Morgan").first.get_by_role("button", name="Take a seat").click(); expect(c.get_by_text("You're in Kai's car.")).to_be_visible(); step("Jin takes a seat")
        c.reload(); expect(c.get_by_text("8:45").first).to_be_visible(); step("leaving time kept in the event's time zone")
    section("carpool", carpool)

    def check_in_and_attendance():
        k.goto(f"{BASE}/t/{TEAM}/e/{NOW_EV}"); settle(k); expect(k.get_by_role("heading", name=re.compile("Check in at Invista Centre"))).to_be_visible()
        k.get_by_role("button", name="I'm here").click(); expect(k.get_by_text(re.compile(r"You're [\d,]+ m from Invista Centre"))).to_be_visible(); step("check-in refused far away")
        k_ctx.set_geolocation({"latitude": 44.25395, "longitude": -76.57315, "accuracy": 12})
        k.get_by_role("button", name="I'm here").click(); expect(k.get_by_role("heading", name="You're checked in")).to_be_visible(); step("Kai checks in at the pitch")
        assert sql(f"select sum(points) from points_ledger where user_id='{KAI}'") == "1"; step("check-in earns the training point")
        c.goto(f"{BASE}/t/{TEAM}/e/{NOW_EV}/attendance"); settle(c)
        expect(c.locator("li", has_text="Kai Morgan").get_by_role("radio", name="Present")).to_have_attribute("aria-checked", "true"); step("captain sees the check-in")
        c.locator("li", has_text="Jin Varghese").get_by_role("radio", name="Present").click()
        c.get_by_role("button", name="Save attendance").click(); expect(c.get_by_text(re.compile(r"Saved \d+ marks"))).to_be_visible(); step("attendance saved")
        c.goto(f"{BASE}/t/{TEAM}/points"); expect(c.get_by_role("list", name="Leaderboard")).to_be_visible()
        c.select_option("#userId", label="Kai Morgan"); c.fill("#points", "3"); c.fill("#note", "Brought the oranges")
        c.get_by_role("button", name="Add points").click(); expect(c.get_by_text("Points added.")).to_be_visible(); step("manual points")
    section("check-in, attendance, points", check_in_and_attendance)

    def match_day():
        c.goto(f"{BASE}/t/{TEAM}/e/{AWAY}/match"); settle(c)
        c.get_by_role("button", name="Kick off").click(); expect(c.get_by_text(re.compile("Live"))).to_be_visible()
        sel = c.locator("select[name=userId]"); sel.select_option(label=next(o for o in sel.locator("option").all_inner_texts() if "Kai Morgan" in o))
        c.get_by_role("button", name="Add goal").click(); expect(c.get_by_text("Added")).to_be_visible()
        c.get_by_role("button", name="Full time").click(); expect(c.get_by_text("Voting for player of the match is open")).to_be_visible(); settle(c)
        assert sql(f"select status || ' ' || team_score || '-' || opponent_score from scores where event_id='{AWAY}'") == "final 1-0"; step("kick off, goal, full time saved")
        sql(f"insert into attendance (event_id, user_id, status, method, recorded_by) values ('{AWAY}', '{KAI}', 'present', 'staff', '{JIN}'), ('{AWAY}', '{JIN}', 'present', 'staff', '{JIN}') on conflict do nothing")
        k.goto(f"{BASE}/t/{TEAM}/e/{AWAY}/match"); settle(k)
        k.get_by_role("radio", name=re.compile("Jin Varghese")).click(); expect(k.get_by_text("Your vote")).to_be_visible(); step("Kai votes Jin player of the match")
        c.reload(); settle(c); c.get_by_role("button", name="Close voting now").click(); c.wait_for_timeout(1200)
        assert sql(f"select potm_open from events where id='{AWAY}'") == "f"; step("Jin closes the vote")
    section("match day", match_day)

    def sponsors():
        k.goto(f"{BASE}/t/{TEAM}/chat?room=sponsors"); settle(k)
        k.get_by_label("Message", exact=True).fill("Welcome aboard"); k.keyboard.press("Enter"); expect(k.get_by_text("Welcome aboard")).to_be_visible(); settle(k); k.wait_for_timeout(500)
        c.goto(f"{BASE}/t/{TEAM}/sponsors/new"); settle(c)
        c.fill("#name", "Corner Cafe"); c.get_by_role("radio", name="Gold").click(); c.fill("#website", "https://example.com/cafe"); c.fill("#email", "cafe@example.com")
        c.get_by_role("button", name="Add sponsor").click(); c.wait_for_url(re.compile(r"saved=new"))
        expect(c.locator("li", has_text="Corner Cafe").get_by_text("Invite sent")).to_be_visible(); step("Jin adds Corner Cafe as a Gold sponsor")
        href = next(l["href"] for l in json.loads(sql("select payload::text from outbox where payload->>'to' = 'cafe@example.com' order by created_at desc limit 1"))["links"] if l["label"] == "Open the sponsor page")
        sp = ctx().new_page(); watch(sp, "sponsor")
        sp.goto(href); expect(sp.get_by_text("Gold sponsor", exact=True)).to_be_visible()
        n = mail_count("cafe@example.com")
        sp.fill("#firstName", "Sid"); sp.fill("#lastName", "Malhotra"); sp.get_by_role("button", name="Open my sponsor page").click()
        expect(sp.get_by_text("Check your email")).to_be_visible(); sp.goto(link_for("cafe@example.com", n)); settle(sp)
        sp.get_by_role("button", name="Open my sponsor page").click(); sp.wait_for_url(re.compile(r"/sponsor/.+welcome=1")); settle(sp)
        expect(sp.get_by_text("Win at Napanee Rovers").first).to_be_visible(); step("sponsor signs up from the invite and sees the result")
        assert sp.get_by_text("Invista Centre").count() == 0; step("training isn't shown to sponsors")
        c.goto(f"{BASE}/t/{TEAM}/messages/new"); settle(c)
        c.fill("#subject", "New kit Saturday"); c.fill("#body", "With our sponsor on the sleeve.")
        c.get_by_label("Share with our sponsors too").check(); c.get_by_role("button", name=re.compile("^Send")).click(); c.wait_for_url(re.compile(r"sent="))
        sp.reload(); expect(sp.get_by_text("New kit Saturday")).to_be_visible(); step("news shared with sponsors shows on their page")
        sp.goto(f"{BASE}/sponsor-chat/{TEAM}"); settle(sp)
        msgs = sp.get_by_role("list", name="Messages")
        expect(msgs.get_by_text("Kai M.")).to_be_visible(); assert msgs.get_by_text("Kai Morgan").count() == 0; step("sponsor sees Kai as Kai M.")
        sp.get_by_label("Message", exact=True).fill("Free coffee Saturday"); sp.get_by_role("button", name="Send").click()
        expect(msgs.get_by_text("Free coffee Saturday")).to_be_visible(); settle(sp); sp.wait_for_timeout(500); step("sponsor posts to the team")
        k.goto(f"{BASE}/t/{TEAM}/chat?room=sponsors"); settle(k)
        line = k.get_by_role("list", name="Messages").locator("li", has_text="Free coffee Saturday")
        expect(line.get_by_text("Corner Cafe")).to_be_visible(); expect(line.get_by_text("Gold sponsor", exact=True)).to_be_visible(); step("Kai sees the cafe and its Gold badge")
        sp.goto(f"{BASE}/t/{TEAM}/roster"); expect(sp.get_by_text("We couldn't find that page")).to_be_visible(); step("sponsor can't open the roster")
        k.goto(f"{BASE}/t/{TEAM}/schedule"); expect(k.get_by_role("region", name="Our sponsors").get_by_text("Corner Cafe")).to_be_visible(); step("players see the sponsor strip")
    section("sponsors", sponsors)

    def availability():
        k.goto(f"{BASE}/availability"); settle(k)
        k.get_by_role("radio", name="Away").click()
        d = (datetime.datetime.now(TZ) + datetime.timedelta(days=6)).strftime("%Y-%m-%d")
        k.fill("#startsOn", d); k.fill("#endsOn", d); k.fill("#note", "Cousin's wedding")
        k.get_by_role("button", name="Save").click(); k.wait_for_url(re.compile(r"/availability\?saved="))
        c.goto(f"{BASE}/t/{TEAM}/e/{AWAY}/rsvps"); expect(c.get_by_text("Away: Cousin's wedding")).to_be_visible(); step("Kai marks himself away; captain sees why")
        k.goto(f"{BASE}/availability"); k.get_by_role("button", name="I'm back early, clear this").first.click(); k.wait_for_url(re.compile(r"cleared=1")); step("Kai clears it")
    section("availability", availability)

    def email_answer():
        c.goto(f"{BASE}/t/{TEAM}/e/{AWAY}"); settle(c)
        c.get_by_role("button", name=re.compile("^(Remind|Nudge)")).first.click(); c.wait_for_timeout(1500)
        payload = sql("select payload::text from outbox where payload->>'subject' like '%Are you in%' and payload->>'to' = 'kai@example.com' order by created_at desc limit 1")
        href = next(l["href"] for l in json.loads(payload)["links"] if l["label"] == "Going")
        fresh = ctx().new_page(); watch(fresh, "mail"); fresh.goto(href)
        expect(fresh.get_by_text(re.compile("You're in, Kai")).first).to_be_visible(); step("Kai taps Going in the email, not signed in")
        assert sql(f"select response from rsvps where event_id='{AWAY}' and user_id='{KAI}'") == "going"; step("answer saved")
    section("one-tap email answer", email_answer)

    def calendar():
        c.goto(f"{BASE}/calendar/subscribe"); settle(c)
        url = c.locator("input[readonly]").first.input_value()
        body = urllib.request.urlopen(url.replace("webcal:", "http:")).read().decode()
        assert "BEGIN:VCALENDAR" in body and "Napanee Rovers" in body; step("calendar feed lists the team's events")
        c.get_by_role("button", name=re.compile("Reset")).click(); c.get_by_role("button", name=re.compile("Reset")).last.click(); c.wait_for_timeout(1000)
        try:
            urllib.request.urlopen(url.replace("webcal:", "http:")); raise AssertionError("old feed still works")
        except urllib.error.HTTPError as e:
            assert e.code == 404
        step("reset stops the old feed")
    section("calendar feed", calendar)

    def exports():
        r = c.request.get(f"{BASE}/t/{TEAM}/export/players.csv"); assert r.status == 200 and "Kai" in r.text(), r.status
        r = k.request.get(f"{BASE}/t/{TEAM}/export/players.csv"); assert r.status == 403, r.status
        step("captain exports players; player can't")
    section("exports", exports)

    b.close()
if errors: print("\nconsole errors:"); [print(" ", e) for e in errors[:15]]
print("\nFAILED:", failed if failed else "none")
sys.exit(1 if failed or errors else 0)
