"""Team invite link: captain copies it, a new person signs up from it and joins, approval
mode, reset kills the old link, players can't see it. Fresh server please."""
import re, sys
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"; OUT = "/home/claude/team-app/replica/clone-screens"
errors = []
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
def page(b, dark=False):
    return b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="dark" if dark else "light").new_page()
def login(b, name):
    p = page(b); watch(p, name)
    p.goto(f"{BASE}/login"); p.get_by_role("button", name=re.compile(name)).click(); p.wait_for_url(f"{BASE}/"); return p
def shot(p, n): p.wait_for_timeout(250); p.screenshot(path=f"{OUT}/{n}.png", full_page=True)
def fits(p, label):
    sw = p.evaluate("document.documentElement.scrollWidth")
    if sw > 390: errors.append(f"overflow {label}: {sw}px")
def step(m): print("✓", m, flush=True)
def sign_up(p, first, last, email):
    p.fill("#firstName", first); p.fill("#lastName", last); p.fill("#email", email)
    p.get_by_role("button", name="Create account").click()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pr = login(b, "Priya Raman")
    pr.goto(f"{BASE}/t/t-strikers/roster/add")
    card = pr.get_by_role("region", name="Invite link")
    url = card.get_by_role("textbox", name="Invite link").input_value()
    assert re.fullmatch(rf"{BASE}/join/[A-Za-z0-9_-]{{22}}", url), url; step("captain sees the team's invite link")
    expect(card.get_by_role("link", name="WhatsApp")).to_have_attribute("href", re.compile(r"^https://wa\.me/\?text=.*join"))
    card.get_by_text("Show QR code").click(); expect(card.get_by_role("img", name=re.compile("QR code")).locator("svg")).to_be_visible(); step("WhatsApp button and QR code")
    fits(pr, "add people"); shot(pr, "invite-link-card")

    # A brand-new person opens the link
    new = page(b); watch(new, "new1")
    new.goto(url)
    expect(new.get_by_text("You're invited to join")).to_be_visible(); expect(new.get_by_role("heading", name="Kingston Strikers")).to_be_visible()
    assert new.get_by_text("Rahul").count() == 0; step("join page shows the team, not the roster")
    fits(new, "join page"); shot(new, "join-page")
    sign_up(new, "Leo", "Fernandes", "leo@example.com"); new.wait_for_url(url)
    new.get_by_role("button", name="Join Kingston Strikers").click(); new.wait_for_url(re.compile(r"/t/t-strikers/schedule\?joined=1"))
    expect(new.get_by_text("You're on the team.")).to_be_visible(); step("signs up from the link and joins in one tap")
    new.goto(url); expect(new.get_by_text("You're already on Kingston Strikers.")).to_be_visible(); step("opening it again says already on the team")

    pr.goto(f"{BASE}/t/t-strikers/roster"); expect(pr.get_by_text("Leo Fernandes")).to_be_visible(); step("Leo is on the roster as a player")
    pr.goto(f"{BASE}/dev/outbox"); expect(pr.get_by_text("Kingston Strikers · Leo Fernandes joined").first).to_be_visible(); step("captain gets an email")

    # Approval on
    pr.goto(f"{BASE}/t/t-strikers/roster/add"); card = pr.get_by_role("region", name="Invite link")
    card.get_by_label("Approve each person first").check(); expect(card.get_by_text("People who open the link ask to join")).to_be_visible(); step("captain switches approval on")
    n2 = page(b, dark=True); watch(n2, "new2")
    n2.goto(url); sign_up(n2, "Ana", "Silva", "ana@example.com"); n2.wait_for_url(url)
    n2.get_by_role("button", name="Ask to join").click()
    expect(n2.get_by_text("Asked to join")).to_be_visible(); fits(n2, "join dark"); shot(n2, "join-page-asked-dark"); step("with approval, a new person asks instead")
    n2.goto(f"{BASE}/t/t-strikers/schedule")
    if n2.get_by_text("We couldn't find that page").count() == 0: errors.append("Ana reached the team before approval")
    step("and can't open the team yet")
    pr.goto(f"{BASE}/t/t-strikers/roster")
    req = pr.locator("section[aria-labelledby=jr-h]"); expect(req.get_by_text("Ana Silva")).to_be_visible()
    req.get_by_role("button", name="Add to the team").click(); expect(pr.locator("ul[aria-label=Players]").get_by_text("Ana Silva")).to_be_visible(); step("captain lets her in")

    # Reset
    pr.goto(f"{BASE}/t/t-strikers/roster/add"); card = pr.get_by_role("region", name="Invite link")
    card.get_by_label("Approve each person first").uncheck(); pr.wait_for_timeout(300)
    card.get_by_role("button", name="Reset link").click(); card.get_by_role("button", name="Reset link").click()
    expect(card.get_by_text("New link made")).to_be_visible()
    expect(card.get_by_role("textbox", name="Invite link")).not_to_have_value(url); new_url = card.get_by_role("textbox", name="Invite link").input_value(); step("reset makes a new link")
    n3 = page(b); watch(n3, "new3"); n3.goto(url)
    expect(n3.get_by_text("This invite link doesn't work any more")).to_be_visible(); step("old link stops working")
    n3.goto(new_url); expect(n3.get_by_role("heading", name="Kingston Strikers")).to_be_visible(); step("new link works")
    n3.goto(f"{BASE}/join/nonsense"); expect(n3.get_by_text("This invite link doesn't work any more")).to_be_visible(); step("made-up link is refused")

    # Players can't see the link
    ra = login(b, "Rahul Menon"); ra.goto(f"{BASE}/t/t-strikers/roster/add")
    assert ra.get_by_role("region", name="Invite link").count() == 0; assert new_url not in ra.content(); step("players don't get the link")

    b.close()
if errors:
    print("\n".join(errors)); sys.exit(1)
print("all good")
