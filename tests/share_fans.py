# Sample-data build: tournament banner + venue lock; sponsors without email or badge and
# their social posts; the team fan page with Follow and the QR poster.
import re, datetime
import _waits  # noqa: F401
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect, Locator

_click = Locator.click
def _settled_click(self, *a, **k):
    _click(self, *a, **k)
    try:
        self.page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
Locator.click = _settled_click

BASE = "http://localhost:3000"
SHOTS = "/tmp/claude-0"
errors = []

banner = f"{SHOTS}/test-banner.png"
im = Image.new("RGB", (2400, 800), "#1d4ed8"); d = ImageDraw.Draw(im); d.rectangle([100, 100, 2300, 700], outline="white", width=30); im.save(banner)

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def no_sideways(p, where):
    w = p.evaluate("document.documentElement.scrollWidth")
    assert w <= 391, f"sideways scroll on {where}: {w}"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto")
    ctx.route("https://photon.komoot.io/**", lambda r: r.abort())
    ctx.route(re.compile(r"https://.*(openstreetmap|cartocdn|arcgisonline).*"), lambda r: r.abort())
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(p.url + " " + str(e)[:80]))
    p.on("dialog", lambda d: d.accept())

    # 1) Banner on a tournament; the location can still change before the first day.
    login(p, "Dan")
    p.goto(f"{BASE}/tournaments/new")
    p.fill("#name", "Poster Cup")
    p.get_by_role("radio", name=re.compile("^Knockout")).click()
    p.fill("#startsOn", "2026-12-12"); p.fill("#endsOn", "2026-12-12")
    p.get_by_label("Banner or poster").set_input_files(banner)
    expect(p.get_by_alt_text("Banner preview")).to_be_visible()
    p.fill("#venueName", "Caraco Park")
    p.get_by_role("button", name="Create tournament").click()
    p.wait_for_url(re.compile(r"/tournaments/[^/]+/teams\?created=1"))
    tid = re.search(r"/tournaments/([^/]+)/teams", p.url).group(1)
    hb = p.get_by_alt_text("Poster Cup banner")
    expect(hb).to_be_visible()
    src = hb.get_attribute("src"); r = p.request.get(BASE + src); assert r.status == 200 and r.headers["content-type"] == "image/jpeg", (r.status, r.headers)
    box = hb.bounding_box(); assert box["width"] > 300 and box["height"] < 200, box  # wide, not cropped to a square
    p.screenshot(path=f"{SHOTS}/banner-header.png")
    p.goto(f"{BASE}/tournaments/{tid}/manage")
    expect(p.get_by_text("You can change the location until the tournament's first day.")).to_be_visible()
    p.fill("#venueName", "Invista Centre"); p.get_by_role("button", name="Save changes").click()
    p.goto(f"{BASE}/tournaments/{tid}"); expect(p.get_by_text("Invista Centre").first).to_be_visible()
    public = p.get_by_role("link", name="Public page").get_attribute("href")
    p.context.clear_cookies(); p.goto(BASE + public)
    expect(p.get_by_alt_text("Poster Cup banner")).to_be_visible()
    # A tournament that starts today: the location is locked.
    login(p, "Dan")
    today = datetime.date.today().isoformat()
    p.goto(f"{BASE}/tournaments/new")
    p.fill("#name", "Today Cup"); p.get_by_role("radio", name=re.compile("^Knockout")).click()
    p.fill("#startsOn", today); p.fill("#endsOn", today); p.fill("#venueName", "Caraco Park")
    p.get_by_role("button", name="Create tournament").click(); p.wait_for_url(re.compile(r"/teams\?created=1"))
    t2 = re.search(r"/tournaments/([^/]+)/teams", p.url).group(1)
    p.goto(f"{BASE}/tournaments/{t2}/manage")
    expect(p.get_by_text("The tournament has started, so the location is locked.")).to_be_visible()
    expect(p.locator("#venueName")).to_have_count(0)
    p.get_by_role("button", name="Save changes").click()
    expect(p.get_by_text("The tournament has started, so the location is locked.")).to_be_visible()

    # 2) A sponsor with just a name: no email, no badge.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/sponsors/new")
    p.fill("#name", "Lakeside Bakery")
    p.get_by_role("button", name="Add sponsor").click(); p.wait_for_url(re.compile(r"saved=new"))
    row = p.locator("li", has_text="Lakeside Bakery")
    expect(row).to_be_visible(); expect(row.get_by_text("Invite sent")).to_have_count(0)
    p.goto(f"{BASE}/t/t-strikers/schedule")
    expect(p.get_by_role("region", name="Our sponsors").get_by_text("Lakeside Bakery")).to_be_visible()

    # Share tab: QR poster, sponsor grid and a welcome post for each sponsor, all real images.
    p.goto(f"{BASE}/t/t-strikers/share")
    expect(p.get_by_role("heading", name="Bring in your fans")).to_be_visible()
    imgs = p.locator("img[src^='/api/share/']")
    expect(imgs.first).to_be_visible()
    for s in imgs.evaluate_all("els => els.map(e => e.getAttribute('src'))"):
        r = p.request.get(BASE + s); assert r.status == 200 and r.headers["content-type"] == "image/png", (s, r.status)
    assert any("Lakeside" in (x or "") for x in p.locator("details li p").all_text_contents())
    p.screenshot(path=f"{SHOTS}/share-tab.png", full_page=True)
    no_sideways(p, "share tab")

    # 3) The fan page: visitors can see it and are sent to sign in to follow.
    p.context.clear_cookies()
    p.goto(f"{BASE}/f/t-strikers")
    expect(p.get_by_role("heading", name="Kingston Strikers")).to_be_visible()
    expect(p.get_by_text("Coming up")).to_be_visible()
    expect(p.get_by_text(re.compile("^0 followers$"))).to_be_visible()
    assert "/login?next=" in p.get_by_role("link", name="Follow").get_attribute("href")
    no_sideways(p, "fan page")
    # Marcus (not on the Strikers) follows; it shows on his Teams page.
    login(p, "Marcus")
    p.goto(f"{BASE}/f/t-strikers")
    p.get_by_role("button", name="Follow").click()
    expect(p.get_by_role("button", name="Following")).to_be_visible()
    p.reload(); expect(p.get_by_text(re.compile("^1 follower$"))).to_be_visible()
    p.goto(f"{BASE}/teams")
    expect(p.locator("#follow-h ~ ul")).to_contain_text("Kingston Strikers")
    # Members see they're on the team instead of a Follow button.
    login(p, "Priya")
    p.goto(f"{BASE}/f/t-strikers"); expect(p.get_by_text("You're on this team")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/fan-page.png", full_page=True)
    b.close()

real = [e for e in errors if "#418" not in e]
assert not real, real
print("share_fans: all checks pass")
