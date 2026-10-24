import re, sys
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect
BASE = "http://localhost:3000"; OUT = "/home/claude/team-app/replica/clone-screens"
errors = []
def watch(p, who):
    p.on("console", lambda m: errors.append(f"{who}: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "Failed to load resource" not in m.text else None)
    p.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
def login(b, name):
    p = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2).new_page(); watch(p, name)
    p.goto(f"{BASE}/login"); p.get_by_role("button", name=re.compile(name)).click(); p.wait_for_url(f"{BASE}/")
    return p
def step(m): print("✓", m, flush=True)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    # match day: Rahul votes on the last match, Priya keeps score on a new match
    r = login(b, "Rahul Menon")
    r.goto(f"{BASE}/t/t-strikers/e/e-s-past-1/match"); expect(r.get_by_text("Player of the match")).to_be_visible()
    r.get_by_role("radio", name=re.compile("Jordan Blake")).click(); expect(r.get_by_text("Your vote")).to_be_visible()
    r.screenshot(path=f"{OUT}/S21-result-vote.png", full_page=True); step("Rahul votes for Jordan")
    expect(r.get_by_role("radio", name=re.compile("Rahul Menon"))).to_be_disabled(); step("can't vote for yourself")
    # carpool: Rahul takes a seat in Aisha's car for Napanee
    r.goto(f"{BASE}/t/t-reserves/e/e-r-g1/carpool")
    car = r.locator("li", has_text="Aisha Shah").first
    car.get_by_role("button", name="Take a seat").click(); expect(r.get_by_text("You're in Aisha's car.")).to_be_visible()
    r.screenshot(path=f"{OUT}/S-carpool.png", full_page=True); step("Rahul takes a seat")
    full = r.locator("li", has_text="Leo Grant").first
    expect(full.get_by_text("This car is full")).to_be_visible(); step("full car shows as full")
    # dues: Rahul's own balance on the Reserves
    r.goto(f"{BASE}/t/t-reserves/dues"); expect(r.get_by_text("Your dues")).to_be_visible()
    r.get_by_role("button", name="I've paid").click(); expect(r.get_by_text("waiting for the treasurer to confirm")).to_be_visible()
    r.screenshot(path=f"{OUT}/S-dues-player.png", full_page=True); step("Rahul reports his $40")
    # treasurer confirms
    a = login(b, "Aisha Shah")
    a.goto(f"{BASE}/t/t-reserves/dues"); expect(a.get_by_text("payments to confirm")).to_be_visible()
    a.screenshot(path=f"{OUT}/S-dues-treasurer.png", full_page=True)
    row = a.locator("div", has_text=re.compile("^Rahul Menon")).filter(has=a.get_by_role("button", name="Confirm")).last
    a.get_by_role("button", name="Confirm").first.click(); a.wait_for_timeout(800); step("treasurer confirms a payment")
    # priya keeps score on today's match
    p = login(b, "Priya Raman")
    p.goto(f"{BASE}/t/t-strikers/e/e-s-g1/match")
    p.get_by_role("button", name="Kick off").click(); expect(p.get_by_text(re.compile("Live"))).to_be_visible()
    p.locator("select[name=userId]").select_option(label="#10 Rahul Menon")
    p.get_by_role("button", name="Add goal").click(); expect(p.get_by_text("Added")).to_be_visible()
    p.get_by_role("button", name="Full time").click(); expect(p.get_by_text(re.compile("Full time"))).to_be_visible()
    p.screenshot(path=f"{OUT}/S20-score.png", full_page=True); step("captain kicks off, adds a goal, full time")
    # event manager
    p.goto(f"{BASE}/t/t-strikers/e/e-s-g3/managers"); p.get_by_role("button", name="Make them event manager").click()
    expect(p.get_by_text("They'll see the tools on this event.")).to_be_visible(); step("Priya hands a match to an event manager")
    b.close()
print("\nERRORS:" if errors else "\nno console errors"); [print(" ", e) for e in errors]
sys.exit(1 if errors else 0)
