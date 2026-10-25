"""Live build: emails go out through Resend (a local stand-in on :4010). Sign-up, a player
joining by link (the captain's notice comes from the database), a team message to everyone,
the daily backstop needing its secret, and nothing sent twice."""
import re, sys, json, html, time, subprocess, urllib.request
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; MAIL = "/var/tmp/sbstack/mail.jsonl"; SENT = "/var/tmp/sbstack/resend.jsonl"
def sql(q): return subprocess.check_output(["psql", "-h", "/var/tmp/pgtest", "-p", "5499", "-U", "postgres", "-d", "sb", "-Atc", q]).decode().strip()
def step(m): print("✓", m, flush=True)
def settle(p):
    try: p.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
def sent():
    try: return [json.loads(l) for l in open(SENT) if l.strip()]
    except FileNotFoundError: return []
def wait_sent(pred, what):
    for _ in range(60):
        hit = [m for m in sent() if pred(m)]
        if hit: return hit
        time.sleep(0.25)
    raise AssertionError(f"not sent: {what}; got {[ (m['to'], m['subject']) for m in sent()]}")
def link_for(email, n):
    for _ in range(60):
        ms = [json.loads(l) for l in open(MAIL) if email in l]
        if len(ms) > n: return html.unescape(re.search(r'href="([^"]+/verify\?[^"]+)"', ms[-1]["body"]).group(1))
        time.sleep(0.25)
    raise AssertionError("no sign-in email")
def sign_up(p, first, last, email, nxt=""):
    p.goto(f"{BASE}/login{nxt}"); settle(p)
    n = sum(1 for l in open(MAIL) if email in l) if __import__("os").path.exists(MAIL) else 0
    p.fill("#firstName", first); p.fill("#lastName", last); p.fill("#email", email)
    p.get_by_role("button", name="Create account").click(); expect(p.get_by_text("Check your email")).to_be_visible()
    p.goto(link_for(email, n)); settle(p)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    c = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    k = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    sign_up(c, "Jin", "Varghese", "jin@example.com")
    c.goto(f"{BASE}/teams/new"); settle(c); c.fill("#name", "Riverside First Team"); c.click("text=Create team"); c.wait_for_url(re.compile(r"/you\?new=1"))
    settle(c); c.click("text=Next: add players"); c.wait_for_url(re.compile(r"/roster\?created=1"))
    team = re.search(r"/t/([^/]+)/", c.url).group(1)
    c.goto(f"{BASE}/t/{team}/roster/add"); link = c.get_by_role("textbox", name="Invite link").input_value()
    sign_up(k, "Kai", "Morgan", "kai@example.com")
    k.goto(link); settle(k); k.get_by_role("button", name="Join Riverside First Team").click(); k.wait_for_url(re.compile(r"/schedule\?joined=1"))
    m = wait_sent(lambda m: m["to"] == ["jin@example.com"] and "Kai Morgan joined" in m["subject"], "joined notice")[0]
    assert "Open the roster" in m["html"] and m["from"] == "Team App <team@example.test>" and "Change which emails you get" in m["text"]
    step("captain gets 'Kai Morgan joined' by email, from the database's notice")

    sql(f"update roster_members set permissions = array_append(permissions, 'messages') where team_id='{team}' and not 'messages' = any(permissions) and user_id is not null and 'manage_permissions' = any(permissions)")
    c.goto(f"{BASE}/t/{team}/messages/new"); settle(c)
    c.fill("#subject", "Kit order closes Friday"); c.fill("#body", "Sizes to me by Friday please.\n\nThanks!")
    c.get_by_role("button", name=re.compile("^Send")).click(); c.wait_for_url(re.compile(r"/messages\?sent="))
    got = wait_sent(lambda m: "Kit order closes Friday" in m["subject"] and m["to"] == ["kai@example.com"], "team message")
    assert "<br>" not in got[0]["html"].split("Sizes")[1][:40] and "Thanks!" in got[0]["html"]; step("team message emailed to Kai, paragraphs kept")

    c.goto(f"{BASE}/t/{team}/e/new"); settle(c)
    c.fill("#opponent", "Cataraqui Cobras"); c.fill("#date", "2026-11-07"); c.fill("#startTime", "10:00"); c.fill("#locationText", "Caraco Park")
    c.get_by_role("button", name="Add match").click(); c.wait_for_url(re.compile(r"\?created=1"))
    mail = wait_sent(lambda m: "Cataraqui Cobras" in m["subject"] and m["to"] == ["kai@example.com"], "new match")[0]
    hrefs = re.findall(r'href="([^"]+/r/[^"]+)"', mail["html"]); assert len(hrefs) == 3, hrefs; step("new match emailed with Going / Maybe / Can't make it buttons")
    fresh = b.new_context().new_page(); fresh.goto(html.unescape(hrefs[0])); expect(fresh.get_by_text(re.compile("You're in, Kai")).first).to_be_visible(); step("Kai taps Going in that email")

    pending = sql("select count(*) from outbox where status = 'pending'")
    assert pending == "0", f"still pending: {pending}"; step("nothing left waiting")
    before = len(sent())
    try: urllib.request.urlopen(f"{BASE}/api/outbox"); raise AssertionError("cron without secret worked")
    except urllib.error.HTTPError as e: assert e.code == 401
    r = urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/outbox", headers={"Authorization": "Bearer test-cron-secret"}))
    assert json.loads(r.read())["sent"] == 0 and len(sent()) == before; step("daily backstop needs its secret and sends nothing twice")
    b.close()
print("all good")
