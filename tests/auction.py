# Sample-data build: a player auction. Priya (Strikers captain) sets up two teams, she and Rahul
# captain them, and they bid live from two phones. Checks the clock, budgets, pass/unsold, undo.
import re, time
from PIL import Image, ImageDraw
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect, Locator

_click = Locator.click
def _settled_click(self, *a, **k):
    _click(self, *a, **k)
    try:
        self.page.wait_for_load_state("networkidle", timeout=4000)
    except Exception:
        pass
Locator.click = _settled_click

BASE = "http://localhost:3000"
LOGO = "/tmp/claude-0/test-squad-logo.png"
PHOTO = "/tmp/claude-0/test-player-photo.jpg"
POSTER = "/tmp/claude-0/test-poster.jpg"
SPONS = "/tmp/claude-0/test-sponsors.png"
im = Image.new("RGB", (400, 400), "#C0283F"); ImageDraw.Draw(im).ellipse([60, 60, 340, 340], fill="white"); im.save(LOGO)
im = Image.new("RGB", (600, 800), "#3B6E8F"); ImageDraw.Draw(im).ellipse([180, 120, 420, 360], fill="#E8C39E"); im.save(PHOTO)
im = Image.new("RGB", (2400, 600), "#13213D"); ImageDraw.Draw(im).rectangle([100, 100, 2300, 500], fill="#E8A80C"); im.save(POSTER)
im = Image.new("RGB", (1600, 200), "white"); d = ImageDraw.Draw(im)
for i in range(4): d.rectangle([60 + i * 390, 40, 360 + i * 390, 160], fill=["#C0283F", "#1F6FB2", "#2E9E4E", "#8A5A00"][i])
im.save(SPONS)
SHOTS = "/tmp/claude-0"
errors = []

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def no_sideways(p, where):
    w = p.evaluate("document.documentElement.scrollWidth")
    assert w <= 391, f"sideways scroll on {where}: {w}"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    host = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    cap = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    for p in (host, cap):
        p.on("pageerror", lambda e, p=p: errors.append(p.url + " " + str(e)[:80]))
        p.on("dialog", lambda d: d.accept())

    # 1) Priya sets up a 2-team auction: 300 points each, base 50, steps of 10, 6 seconds a player.
    login(host, "Priya")
    host.goto(f"{BASE}/t/t-strikers/auction")
    host.fill("#title", "Winter Cup auction")
    host.fill("#squads", "2"); host.fill("#budget", "300"); host.fill("#basePrice", "50")
    host.fill("#minIncrement", "10"); host.fill("#bidSeconds", "6"); host.fill("#squadMin", "3")
    host.get_by_role("button", name="Set up auction").click()
    host.wait_for_url(re.compile(r"/auction/[0-9a-f-]{36}$"))
    aid = host.url.rsplit("/", 1)[1]

    # Captains: Priya for Red, Rahul for Blue. They join their teams for free.
    cards = host.locator("section[aria-labelledby='sq-h'] li")
    cards.nth(0).get_by_label("Captain").select_option(label="Priya Raman")
    cards.nth(0).get_by_role("button", name=re.compile("^Save")).click()
    expect(host.locator("li[aria-label=\'Team Red\']")).to_contain_text("Captain Priya Raman")
    cards.nth(1).get_by_label("Team name").fill("Blue Bombers")
    cards.nth(1).get_by_label("Captain").select_option(label="Rahul Menon")
    cards.nth(1).get_by_role("button", name=re.compile("^Save")).click()
    expect(host.locator("li[aria-label=\'Blue Bombers\']")).to_contain_text("Captain Rahul Menon")
    # Team Red's logo, Ade's photo; his position comes from the roster.
    host.locator("input[type=file][aria-label='Logo for Team Red']").set_input_files(LOGO)
    expect(host.get_by_role("button", name="Logo for Team Red").locator("img")).to_be_visible()
    host.locator("input[type=file][aria-label='Photo for Ade Bello']").set_input_files(PHOTO)
    expect(host.get_by_role("button", name="Photo for Ade Bello").locator("img")).to_be_visible()
    expect(host.get_by_label("Position for Ade Bello")).to_have_value("Defence")
    host.get_by_label("Position for Sam Okafor").fill("Goalkeeper"); host.get_by_label("Position for Sam Okafor").blur()
    # Ade's a star: base 80. Tom isn't playing.
    host.get_by_label("Base price for Ade Bello").fill("80"); host.get_by_label("Base price for Ade Bello").blur()
    host.get_by_role("button", name="Remove Tom", exact=False).first.click()
    host.fill("#guest", "Guest Gary"); host.get_by_role("button", name="Add", exact=True).click()
    expect(host.get_by_text("Guest Gary").first).to_be_visible()
    host.screenshot(path=f"{SHOTS}/auction-setup.png", full_page=True)
    no_sideways(host, "auction setup")
    # Rahul runs the big screen (the monitor).
    host.locator("#monitor").select_option(label="Rahul Menon")
    expect(host.get_by_role("region", name="Big screen", exact=True)).to_contain_text("Rahul Menon is the monitor")
    screen_url = host.get_by_role("link", name="Open big screen").get_attribute("href")
    assert "/screen/" in screen_url, screen_url
    # Banners: a poster on top, sponsors at the bottom.
    host.locator("input[type=file][aria-label='Tournament poster']").set_input_files(POSTER)
    expect(host.get_by_role("img", name="Tournament poster")).to_be_visible()
    host.locator("input[type=file][aria-label='Sponsors banner']").set_input_files(SPONS)
    expect(host.get_by_role("img", name="Sponsors banner")).to_be_visible()
    host.get_by_role("button", name="Start the auction").click()
    expect(host.get_by_text("Live", exact=True)).to_be_visible()

    # The TV: the private link, no sign-in.
    tv = b.new_context(viewport={"width": 1920, "height": 1080}).new_page()
    tv.on("pageerror", lambda e: errors.append("tv " + str(e)[:80]))
    tv.goto(screen_url.replace("https://clbx.ca", BASE))
    expect(tv.get_by_text("WINTER CUP AUCTION", exact=False).first).to_be_visible()
    expect(tv.get_by_text("Here we go")).to_be_visible()
    for name in ("Tournament poster", "Sponsors"):
        el = tv.get_by_role("img", name=name, exact=True)
        expect(el).to_be_visible()
        tv.wait_for_function("(el) => el.complete && el.naturalWidth > 0", arg=el.element_handle())

    # 2) Rahul watches from his phone.
    login(cap, "Rahul")
    cap.goto(f"{BASE}/auction/{aid}")
    expect(cap.get_by_text("You're bidding for Blue Bombers")).to_be_visible()
    expect(cap.get_by_role("region", name="Big screen", exact=True)).to_contain_text("You're the monitor")
    expect(cap.get_by_text("Waiting for the next player")).to_be_visible()

    # 3) Ade goes up (base 80). Rahul 80, Priya 90, Rahul jumps to 150; Priya sells now.
    host.get_by_label("Choose who goes next").select_option(label="Ade Bello (80)")
    host.get_by_role("button", name="Put up").click()
    up = cap.get_by_role("region", name="Up now")
    expect(up).to_contain_text("Ade Bello")
    up.get_by_role("button", name="80", exact=True).click()
    expect(host.get_by_role("status")).to_contain_text("80 Blue Bombers")
    host.get_by_role("region", name="Up now").get_by_role("button", name="90", exact=True).click()
    expect(cap.get_by_role("status")).to_contain_text("90 Team Red")
    cap.fill("#custom-bid", "150"); cap.get_by_role("button", name="Bid", exact=True).click()
    expect(host.get_by_role("status")).to_contain_text("150 Blue Bombers")
    cap.screenshot(path=f"{SHOTS}/auction-live.png", full_page=True)
    no_sideways(cap, "auction live")
    expect(tv.get_by_text("On the block")).to_be_visible(timeout=5000)
    expect(tv.get_by_role("region", name="Up now")).to_contain_text("150")
    expect(tv.get_by_role("region", name="Up now")).to_contain_text("Defence")
    card_img = tv.get_by_role("region", name="Up now").locator("img").first
    expect(card_img).to_be_visible()
    assert tv.evaluate("(el) => el.naturalWidth", card_img.element_handle()) > 0, "player photo didn't load on the TV"
    expect(tv.locator("article[aria-label='Team Red'] img")).to_be_visible()
    tv.screenshot(path=f"{SHOTS}/auction-tv-live.png")
    ph0 = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    ph0.goto(screen_url.replace("https://clbx.ca", BASE))
    expect(ph0.get_by_text("On the block")).to_be_visible()
    no_sideways(ph0, "big screen live on a phone")
    ph0.screenshot(path=f"{SHOTS}/auction-phone-live.png", full_page=True)
    host.get_by_role("button", name="Sold now").click()
    expect(tv.get_by_text("SOLD", exact=True)).to_be_visible(timeout=5000)
    tv.wait_for_timeout(1500)
    tv.screenshot(path=f"{SHOTS}/auction-tv-sold.png")
    expect(host.get_by_text(re.compile("Ade Bello sold to Blue Bombers for 150"))).to_be_visible()
    expect(cap.locator("li[aria-label=\'Blue Bombers\']")).to_contain_text("150 left")

    # 4) Budgets: Blue has 150 left and needs 3 players (has 2), so it can spend all 150 on one.
    #    The clock decides the next one: Rahul bids, nobody answers, it's his.
    host.get_by_label("Choose who goes next").select_option(label="Sam Okafor (50)")
    host.get_by_role("button", name="Put up").click()
    expect(cap.get_by_text("You can bid up to 150.")).to_be_visible()
    cap.get_by_role("region", name="Up now").get_by_role("button", name="50", exact=True).click()
    expect(cap.get_by_text(re.compile("Sam Okafor sold to Blue Bombers for 50"))).to_be_visible(timeout=20000)
    expect(cap.locator("li[aria-label=\'Blue Bombers\']")).to_contain_text("100 left")

    # 5) Pass on someone, undo the last sale, bring the unsold back.
    host.get_by_label("Choose who goes next").select_option(label="Jordan Blake (50)")
    host.get_by_role("button", name="Put up").click()
    host.get_by_role("button", name="Pass (unsold)").click()
    expect(host.get_by_text("Jordan Blake went unsold")).to_be_visible()
    host.get_by_role("button", name="Undo last sale").click()
    expect(host.locator("li[aria-label=\'Blue Bombers\']")).to_contain_text("150 left")
    host.get_by_role("button", name=re.compile("Bring back 1 unsold")).click()
    expect(host.get_by_label("Choose who goes next").locator("option", has_text="Jordan Blake")).to_have_count(1)

    # 6) Team Red can't go above its limit: 300 left, needs 2 more after this one at base 50 → 250 max.
    host.get_by_label("Choose who goes next").select_option(label="Chris Wong (50)")
    host.get_by_role("button", name="Put up").click()
    expect(host.get_by_text("You can bid up to 250.")).to_be_visible()
    host.fill("#custom-bid", "260"); host.get_by_role("button", name="Bid", exact=True).click()
    expect(host.get_by_role("alert").filter(has_text="can bid up to 250")).to_be_visible()
    host.get_by_role("button", name="Pass (unsold)").click()

    # The summary (host and monitor).
    summary = host.get_by_role("region", name="Summary")
    expect(summary).to_contain_text("Biggest buys")
    expect(summary).to_contain_text("Ade Bello")

    # 7) Finish: the teams are picked.
    host.get_by_role("button", name="Finish auction").click()
    expect(host.get_by_text("The teams are picked.")).to_be_visible()
    expect(cap.get_by_text("The teams are picked.")).to_be_visible(timeout=10000)
    host.screenshot(path=f"{SHOTS}/auction-done.png", full_page=True)
    expect(tv.get_by_text("The teams are set")).to_be_visible(timeout=5000)
    tv.screenshot(path=f"{SHOTS}/auction-tv-done.png")
    # The same screen on a phone held upright.
    ph = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    ph.goto(screen_url.replace("https://clbx.ca", BASE))
    expect(ph.get_by_text("The teams are set")).to_be_visible()
    no_sideways(ph, "big screen on a phone")
    ph.screenshot(path=f"{SHOTS}/auction-phone-done.png", full_page=True)
    # The tab shows it as finished.
    host.goto(f"{BASE}/t/t-strikers/auction")
    expect(host.get_by_role("link", name=re.compile("Winter Cup auction")).first).to_contain_text("Finished")
    b.close()

real = [e for e in errors if "#418" not in e]
assert not real, real
print("auction: all checks pass")
