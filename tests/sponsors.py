"""Sponsors end to end: badges, sponsor view, what stays hidden, adding and inviting a
sponsor, hiding an event, sharing news, ending a deal, club sponsors. Fresh server please."""
import re, sys
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; OUT = "/home/claude/team-app/replica/clone-screens"
errors = []
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
def page(b, dark=False):
    p = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="dark" if dark else "light").new_page(); return p
def login(b, name, dark=False):
    p = page(b, dark); watch(p, name)
    p.goto(f"{BASE}/login"); p.get_by_role("button", name=re.compile(name)).click(); p.wait_for_url(f"{BASE}/"); return p
def shot(p, n): p.wait_for_timeout(250); p.screenshot(path=f"{OUT}/{n}.png", full_page=True)
def fits(p, label):
    sw = p.evaluate("document.documentElement.scrollWidth")
    if sw > 390: errors.append(f"overflow {label}: {sw}px")
def step(m): print("✓", m, flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    sid = login(b, "Sid Malhotra")
    home = sid.get_by_role("region", name="You sponsor")
    expect(home.get_by_text("Kingston Strikers")).to_be_visible(); expect(home.get_by_text("Gold sponsor", exact=True)).to_be_visible(); step("sponsor's home shows the team and a Gold badge")
    home.get_by_role("link").first.click(); sid.wait_for_url(re.compile(r"/sponsor/sp-cafe"))
    main = sid.locator("main")
    expect(main.get_by_text("Win vs Brockville Blaze")).to_be_visible(); step("sees the result")
    expect(main.get_by_text("vs Belleville United").first).to_be_visible(); expect(main.get_by_text("End-of-season night")).to_be_visible(); step("sees upcoming matches and the social")
    assert main.get_by_text("Training", exact=True).count() == 0 and main.get_by_text(re.compile("Caraco Park")).count() == 0; step("no trainings")
    expect(main.get_by_text("Through to the cup quarter-final")).to_be_visible(); step("sees news the team shared")
    assert main.get_by_text("Pitch fees").count() == 0; step("doesn't see the dues message")
    fellows = sid.get_by_role("region", name="Fellow sponsors")
    expect(fellows.get_by_text("Kingston Kit Co")).to_be_visible(); expect(fellows.get_by_text("Silver sponsor", exact=True)).to_be_visible(); step("fellow sponsors with their badges")
    fits(sid, "sponsor view"); shot(sid, "sponsor-view")
    for path in ["/t/t-strikers/roster", "/t/t-strikers/chat", "/t/t-strikers/dues", "/t/t-strikers/e/e-s-g1", "/t/t-strikers/p/u-rahul", "/t/t-strikers/points"]:
        sid.goto(BASE + path)
        try: expect(sid.get_by_text("We couldn't find that page")).to_be_visible(timeout=8000)
        except AssertionError: errors.append(f"sponsor reached {path}")
    step("sponsor can't open roster, chat, dues, events, profiles or points")
    r = sid.request.get(f"{BASE}/t/t-strikers/export/players.csv"); assert r.status == 403; step("sponsor can't export")

    pr = login(b, "Priya Raman")
    pr.goto(f"{BASE}/t/t-strikers/schedule")
    strip = pr.get_by_role("region", name="Our sponsors")
    expect(strip.get_by_text("Corner Cafe")).to_be_visible(); shot(pr, "sponsor-strip")
    names = strip.locator("li").all_inner_texts(); assert "Corner Cafe" in names[0] and "Princess St Pizza" in names[-1], names; step("schedule shows sponsors, top tier first")
    strip.get_by_role("link", name="Manage").click(); pr.wait_for_url(re.compile(r"/t/t-strikers/sponsors"))
    pr.get_by_role("link", name="Add a sponsor").click()
    pr.fill("#name", "Lakeside Dental"); pr.get_by_role("radio", name="Platinum").click()
    pr.fill("#website", "https://example.com/lakeside"); pr.fill("#email", "dental@example.com")
    shot(pr, "sponsor-add")
    pr.get_by_role("button", name="Add sponsor and send invite").click(); pr.wait_for_url(re.compile(r"saved=new"), wait_until="commit")
    row = pr.locator("li", has_text="Lakeside Dental")
    expect(row.get_by_text("Platinum sponsor", exact=True)).to_be_visible(); expect(row.get_by_text("Invite sent")).to_be_visible(); shot(pr, "sponsor-manage"); step("captain adds a Platinum sponsor, invite sent")

    new = page(b); watch(new, "dental")
    new.goto(f"{BASE}/dev/outbox")
    new.locator("li", has_text="dental@example.com").first.get_by_role("link", name="Open the sponsor page").click()
    new.wait_for_url(re.compile(r"/sponsor-invite/")); expect(new.get_by_text("Platinum sponsor", exact=True)).to_be_visible(); shot(new, "sponsor-invite")
    new.fill("#firstName", "Ana"); new.fill("#lastName", "Reid"); new.get_by_role("button", name="Open my sponsor page").click()
    new.wait_for_url(re.compile(r"/sponsor/.+welcome=1"), wait_until="commit"); expect(new.get_by_text("Win vs Brockville Blaze")).to_be_visible(); step("new sponsor accepts the invite and sees the team")

    pr.goto(f"{BASE}/t/t-strikers/e/e-s-g3/edit"); pr.locator("#sponsorVisible").select_option("hide")
    pr.get_by_role("button", name=re.compile("^Save")).click(); pr.wait_for_url(re.compile(r"saved=1"), wait_until="commit")
    sid.goto(f"{BASE}/sponsor/sp-cafe"); assert sid.get_by_text("vs Belleville United").count() == 0; step("captain hides one match; sponsor no longer sees it")

    pr.goto(f"{BASE}/t/t-strikers/messages/new")
    pr.fill("#subject", "New kit arrives Saturday"); pr.fill("#body", "With our sponsors' logos on the sleeves.")
    pr.get_by_label("Share with our sponsors too").check(); pr.get_by_role("button", name="Send").click(); pr.wait_for_url(re.compile(r"sent="), wait_until="commit")
    sid.goto(f"{BASE}/sponsor/sp-cafe"); expect(sid.get_by_text("New kit arrives Saturday")).to_be_visible(); step("shared announcement reaches the sponsor")

    pr.goto(f"{BASE}/sponsor/sp-kit"); expect(pr.get_by_text("This is what Kingston Kit Co sees")).to_be_visible(); step("captain previews what a sponsor sees")

    # ---- sponsor chat --------------------------------------------------------
    sid.goto(f"{BASE}/sponsor/sp-cafe"); sid.get_by_role("link", name="Chat with the team").click(); sid.wait_for_url(re.compile(r"/sponsor-chat/t-strikers"))
    msgs = sid.get_by_role("list", name="Messages")
    expect(msgs.get_by_text("Priya R.")).to_be_visible(); expect(msgs.get_by_text("Rahul M.")).to_be_visible()
    assert msgs.get_by_text("Priya Raman").count() == 0 and msgs.get_by_text("Rahul Menon").count() == 0; step("sponsor sees players as first name and initial")
    sid.get_by_label("Message", exact=True).fill("Free coffee Saturday for anyone in a Strikers shirt"); sid.get_by_role("button", name="Send").click()
    expect(msgs.get_by_text("Free coffee Saturday")).to_be_visible(); fits(sid, "sponsor chat"); shot(sid, "sponsor-chat-sponsor"); step("sponsor posts to the whole team")
    assert sid.get_by_role("navigation", name="Chat rooms").count() == 0; step("sponsor only gets the sponsor room")
    sid.goto(f"{BASE}/chat"); expect(sid.get_by_role("link", name=re.compile("Kingston Strikers · sponsor chat"))).to_be_visible(); step("sponsor's chat list has the sponsor room")
    sid.goto(f"{BASE}/t/t-strikers/chat?room=sponsors"); expect(sid.get_by_text("We couldn't find that page")).to_be_visible(); step("sponsor can't use the team's own chat pages")

    rh = login(b, "Rahul Menon")
    rh.goto(f"{BASE}/t/t-strikers/chat")
    tab = rh.get_by_role("navigation", name="Chat rooms").get_by_role("link", name=re.compile("Sponsors"))
    expect(tab).to_contain_text(re.compile(r"\d")); tab.click(); rh.wait_for_url(re.compile(r"room=sponsors"))
    rmsgs = rh.get_by_role("list", name="Messages")
    sidline = rmsgs.locator("li", has_text="Free coffee Saturday")
    expect(sidline.get_by_text("Corner Cafe")).to_be_visible(); expect(sidline.get_by_text("Gold sponsor", exact=True)).to_be_visible()
    expect(rmsgs.get_by_text("Priya", exact=True).first).to_be_visible(); step("players see the sponsor's business and Gold badge")
    rh.get_by_role("button", name="More for Sid's message").last.click(); rh.get_by_role("button", name="Reply").click()
    rh.get_by_label("Message", exact=True).fill("Cheers Sid!"); rh.get_by_role("button", name="Send").click()
    expect(rmsgs.get_by_text("Cheers Sid!")).to_be_visible(); shot(rh, "sponsor-chat-player"); step("player replies to the sponsor")
    sid.goto(f"{BASE}/sponsor-chat/t-strikers"); expect(sid.get_by_text("Cheers Sid!")).to_be_visible(); step("sponsor sees the reply")

    pr.goto(f"{BASE}/t/t-strikers/settings"); pr.get_by_label("Sponsor chat").uncheck(); pr.get_by_role("button", name=re.compile("^Save")).click(); pr.wait_for_timeout(1200)
    sid.goto(f"{BASE}/sponsor/sp-cafe"); assert sid.get_by_role("link", name="Chat with the team").count() == 0
    sid.goto(f"{BASE}/sponsor-chat/t-strikers"); expect(sid.get_by_text("We couldn't find that page")).to_be_visible()
    rh.goto(f"{BASE}/t/t-strikers/chat"); assert rh.get_by_role("link", name=re.compile("^Sponsors")).count() == 0; step("captain switches sponsor chat off for everyone")
    pr.goto(f"{BASE}/t/t-strikers/settings"); pr.get_by_label("Sponsor chat").check(); pr.get_by_role("button", name=re.compile("^Save")).click(); pr.wait_for_timeout(1200)
    pr.goto(f"{BASE}/t/t-strikers/sponsors")
    pr.locator("li", has_text="Corner Cafe").get_by_role("button", name="End sponsorship").click(); expect(pr.get_by_text("Corner Cafe's sponsorship has ended")).to_be_visible()
    sid.goto(f"{BASE}/sponsor/sp-cafe"); expect(sid.get_by_text("We couldn't find that page")).to_be_visible()
    sid.goto(f"{BASE}/"); assert sid.get_by_role("region", name="You sponsor").count() == 0; step("ending the deal closes the sponsor's page")
    sid.goto(f"{BASE}/sponsor-chat/t-strikers"); expect(sid.get_by_text("We couldn't find that page")).to_be_visible(); step("and their chat")

    pl = login(b, "Rahul Menon")
    pl.goto(f"{BASE}/t/t-strikers/sponsors"); assert pl.get_by_text("dental@example.com").count() == 0 and pl.get_by_role("link", name="Edit").count() == 0; step("players see sponsors but no contact details or edit")
    pl.goto(f"{BASE}/sponsor/sp-kit"); expect(pl.get_by_text("We couldn't find that page")).to_be_visible(); step("players can't open a sponsor's page")

    dan = login(b, "Dan Kowalski", dark=True)
    dan.goto(f"{BASE}/clubs/c-lcfc/sponsors"); expect(dan.locator("li", has_text="Limestone Motors").get_by_text("Diamond sponsor", exact=True)).to_be_visible(); shot(dan, "dark-club-sponsors"); step("club sponsors with a Diamond badge (dark)")
    dan.goto(f"{BASE}/t/t-reserves/schedule"); expect(dan.get_by_role("region", name="Our sponsors").get_by_text("Limestone Motors")).to_be_visible(); step("club sponsors show on every club team")
    dan.goto(f"{BASE}/sponsor/sp-motors"); expect(dan.get_by_role("heading", name="Limestone City First Team")).to_be_visible(); expect(dan.get_by_role("heading", name="Limestone City Reserves")).to_be_visible()
    fits(dan, "club sponsor view dark"); shot(dan, "dark-sponsor-view-club"); step("a club sponsor follows every club team")
    anon = page(b); watch(anon, "visitor"); anon.goto(f"{BASE}/c/limestone-city")
    partners = anon.get_by_role("region", name="Club partners"); expect(partners.get_by_text("Limestone Motors")).to_be_visible()
    assert partners.get_by_text("Wolfe Island Brewing").count() == 0; step("public club page shows active partners only")
    for p, label in [(pr, "manage"), (dan, "club"), (anon, "public")]: fits(p, label)
    b.close()

print("\nERRORS:" if errors else "\nno console errors")
for e in errors: print(" ", e)
sys.exit(1 if errors else 0)
