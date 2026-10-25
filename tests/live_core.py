"""Live build against the local Supabase stand-in (tests/localstack/up.sh, then the live build on :3000).
Real sign-up by email link, a club and team, a match and answers, and a second person joining
by invite link. Run on a fresh stack: the emails it reads come from the local mail catcher."""
import re, sys, json, html, time
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; MAIL = "/var/tmp/sbstack/mail.jsonl"; OUT = "/home/claude/team-app/replica/clone-screens"
errors = []
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
def step(m): print("✓", m, flush=True)
def diag(pg):
    import builtins
    for v in getattr(builtins, "CDP_BYTES", {}).values(): print("POST", v)
    print("DIAG", pg.url, "| busy:", pg.locator("[aria-busy=true]").all_inner_texts(), "| disabled:", pg.locator("button[disabled]").all_inner_texts()[:4], "| alerts:", pg.locator("[role=alert]").all_inner_texts()[:3])
    print("DIAG headings:", pg.locator("h1, h2").all_inner_texts()[:4])
def submit(pg, click, url_re):
    settle(pg); click()
    try: pg.wait_for_url(re.compile(url_re), timeout=15000)
    except Exception:
        diag(pg); pg.screenshot(path="/tmp/claude-0/-home-claude/dfc9fd4f-d579-5240-ac28-0ea6ad2e19a8/scratchpad/stuck.png", full_page=True); raise
def settle(p):
    try: p.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
def shot(p, n): p.wait_for_timeout(300); p.screenshot(path=f"{OUT}/{n}.png", full_page=True)
def link_for(email, after=0.0):
    for _ in range(40):
        try:
            mails = [json.loads(l) for l in open(MAIL) if l.strip()]
        except FileNotFoundError:
            mails = []
        for m in reversed(mails):
            if email in " ".join(m["to"]):
                hit = re.search(r'href="([^"]+/verify\?[^"]+)"', m["body"])
                if hit: return html.unescape(hit.group(1))
        time.sleep(0.25)
    raise AssertionError(f"no sign-in email for {email}")
def mail_count(email):
    try: return sum(1 for l in open(MAIL) if email in l)
    except FileNotFoundError: return 0
def sign_in_link(p, email):
    url = link_for(email); p.goto(url); return url

PAGES = []
def diag_on_fail():
    for pg in PAGES:
        try:
            print("DIAG", pg.url, "busy:", pg.locator("[aria-busy=true]").all_inner_texts(), "disabled:", pg.locator("button[disabled]").all_inner_texts()[:4], "alerts:", pg.locator("[role=alert]").all_inner_texts()[:3])
            print("DIAG h:", pg.locator("h1, h2").all_inner_texts()[:4])
        except Exception as e: print("DIAG fail", e)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = lambda: b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    c = ctx().new_page(); watch(c, "founder"); PAGES.append(c)
    CDP_BYTES = {}
    cdp = c.context.new_cdp_session(c); cdp.send("Network.enable")
    cdp.on("Network.requestWillBeSent", lambda e: CDP_BYTES.__setitem__(e["requestId"], [e["request"]["method"], e["request"]["url"][-50:], 0, "open"]) if e["request"]["method"] == "POST" else None)
    cdp.on("Network.dataReceived", lambda e: CDP_BYTES[e["requestId"]].__setitem__(2, CDP_BYTES[e["requestId"]][2] + e["dataLength"]) if e["requestId"] in CDP_BYTES else None)
    cdp.on("Network.loadingFinished", lambda e: CDP_BYTES[e["requestId"]].__setitem__(3, "finished") if e["requestId"] in CDP_BYTES else None)
    cdp.on("Network.loadingFailed", lambda e: CDP_BYTES[e["requestId"]].__setitem__(3, "failed:" + e.get("errorText","") + (" canceled" if e.get("canceled") else "")) if e["requestId"] in CDP_BYTES else None)
    import builtins; builtins.CDP_BYTES = CDP_BYTES
    import os
    if os.environ.get("BLOCK_PREFETCH"):
        c.route("**/*", lambda r: r.abort() if (r.request.headers.get("next-router-prefetch") == "1") else r.continue_())
    import os
    LOG = open("/tmp/claude-0/-home-claude/dfc9fd4f-d579-5240-ac28-0ea6ad2e19a8/scratchpad/trace.txt", "w")
    c.on("console", lambda m: LOG.write(f"console {m.type} {m.text[:400]}\n"))
    c.on("response", lambda r: LOG.write(f"{round(time.time()%1000,2)} {r.status} {r.request.method} {r.url[-70:]} ct={r.headers.get('content-type')} redir={r.headers.get('x-action-redirect')} setcookie={'set-cookie' in r.headers}\n") if (r.request.method == "POST" or "_rsc" in r.url or r.request.resource_type == "document") else None)
    c.on("framenavigated", lambda f: LOG.write(f"{round(time.time()%1000,2)} NAV {f.url[-70:]}\n") if f == c.main_frame else None)
    c.on("requestfailed", lambda r: LOG.write(f"FAILED {r.method} {r.url[-60:]} {r.failure}\n"))

    c.goto(f"{BASE}/login"); expect(c.get_by_role("heading", name="Sign in")).to_be_visible()
    assert c.get_by_text("Try it as someone on a team").count() == 0; step("live login: email sign-in, no demo accounts")
    c.fill("#signin-email", "nobody@example.com"); c.get_by_role("button", name="Email me a sign-in link").click()
    expect(c.get_by_text("No account with this email yet").first).to_be_visible(); step("unknown email is told to create an account")
    c.fill("#firstName", "Jin"); c.fill("#lastName", "Varghese"); c.fill("#email", "jin@example.com")
    c.check("#agree"); c.get_by_role("button", name="Create account").click()
    expect(c.get_by_text("Check your email")).to_be_visible(); shot(c, "live-check-email"); step("sign-up sends a link")
    sign_in_link(c, "jin@example.com"); c.wait_for_url(f"{BASE}/")
    expect(c.get_by_text("You're not on a team yet")).to_be_visible(); step("link signs Jin in; profile made from the form")

    c.get_by_role("link", name="Set up a club").click(); c.wait_for_url(f"{BASE}/clubs/new")
    c.fill("#name", "Riverside FC"); submit(c, lambda: c.click("text=Create club"), r"/teams/new\?club=")
    expect(c.get_by_text("Riverside FC is set up and you're its owner")).to_be_visible(); step("club saved; Jin is owner")
    c.fill("#name", "Riverside First Team"); submit(c, lambda: c.click("text=Create team"), r"/you\?new=1")
    c.fill("#jersey", "9"); c.fill("#position", "Forward"); c.locator("label", has_text="Manager").click()
    submit(c, lambda: c.click("text=Next: add players"), r"/roster\?created=1")
    me = c.locator("li", has_text="(you)")
    for hat in ["Captain", "Manager", "Club owner"]: expect(me.get_by_text(hat, exact=True)).to_be_visible()
    team_id = re.search(r"/t/([^/]+)/", c.url).group(1); step("team saved; Jin is player #9, captain, manager, club owner")

    c.goto(f"{BASE}/t/{team_id}/e/new")
    c.fill("#opponent", "Cataraqui Cobras"); c.fill("#date", "2026-11-07"); c.fill("#startTime", "10:00"); c.fill("#locationText", "Caraco Park")
    submit(c, lambda: c.get_by_role("button", name="Add match").click(), r"/e/[^/]+\?created=1")
    event_url = c.url.split("?")[0]; expect(c.get_by_text("0 going")).to_be_visible(); step("match saved")
    settle(c); c.get_by_role("button", name="Going", exact=True).click(); expect(c.get_by_text("Saved")).to_be_visible(); c.reload()
    expect(c.get_by_text("1 going")).to_be_visible(); step("Jin answers Going; it sticks after reload")

    c.goto(f"{BASE}/t/{team_id}/roster/add")
    url = c.get_by_role("textbox", name="Invite link").input_value(); assert "/join/" in url; step("invite link from the database")
    p2 = ctx().new_page(); watch(p2, "kai")
    p2.goto(url); expect(p2.get_by_role("heading", name="Riverside First Team")).to_be_visible()
    p2.fill("#firstName", "Kai"); p2.fill("#lastName", "Morgan"); p2.fill("#email", "kai@example.com")
    p2.check("#agree"); p2.get_by_role("button", name="Create account").click(); expect(p2.get_by_text("Check your email")).to_be_visible()
    sign_in_link(p2, "kai@example.com"); p2.wait_for_url(url)
    settle(p2); p2.get_by_role("button", name="Join Riverside First Team").click(); p2.wait_for_url(re.compile(r"/schedule\?joined=1"))
    expect(p2.get_by_text("Cataraqui Cobras").first).to_be_visible(); step("Kai signs up from the link, joins, sees the match")
    p2.goto(event_url); settle(p2); p2.get_by_role("button", name="Maybe", exact=True).click(); expect(p2.get_by_text("Saved")).to_be_visible()
    c.goto(event_url); expect(c.get_by_text("1 going")).to_be_visible(); expect(c.get_by_text("1 maybe")).to_be_visible(); step("captain sees Kai's Maybe")
    c.goto(f"{BASE}/t/{team_id}/roster"); expect(c.get_by_text("Kai Morgan")).to_be_visible(); step("Kai on the roster")
    c.goto(f"{BASE}/dev/outbox"); expect(c.get_by_text("Riverside First Team · Kai Morgan joined").first).to_be_visible(); step("captain's email queued in the outbox")

    # Kai can't do captain things
    p2.goto(f"{BASE}/t/{team_id}/roster/add"); assert p2.get_by_role("region", name="Invite link").count() == 0; step("Kai can't see the invite link")
    p2.goto(f"{BASE}/t/{team_id}/e/new")
    if p2.get_by_role("button", name="Add match").count():
        p2.fill("#opponent", "Hackers"); p2.fill("#date", "2026-11-14"); p2.fill("#startTime", "10:00"); p2.get_by_role("button", name="Add match").click(); p2.wait_for_timeout(1500)
        c.goto(f"{BASE}/t/{team_id}/schedule"); assert c.get_by_text("Hackers").count() == 0
    step("Kai can't add a match")

    # sign out and back in with a link
    c.goto(f"{BASE}/account"); c.get_by_role("button", name="Sign out").click(); c.wait_for_url(re.compile(r"/login"))
    n = mail_count("jin@example.com")
    c.fill("#signin-email", "jin@example.com"); c.get_by_role("button", name="Email me a sign-in link").click(); expect(c.get_by_text("Check your email")).to_be_visible()
    for _ in range(40):
        if mail_count("jin@example.com") > n: break
        time.sleep(0.25)
    sign_in_link(c, "jin@example.com"); c.wait_for_url(f"{BASE}/"); expect(c.get_by_text("Riverside First Team").first).to_be_visible(); step("sign out, then back in with a fresh link")
    b.close()
if errors:
    print("\n".join(errors)); sys.exit(1)
print("all good")
