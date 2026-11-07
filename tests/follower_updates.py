# Sample-data build: followers choose their updates. Marcus follows the Strikers and turns off
# open games; Priya's drop-in skips him, her new match and team news reach him, and when the
# team stops sharing results he can't pick them any more.
import re
from datetime import date, timedelta
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []
day = (date.today() + timedelta(days=4)).isoformat()

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def outbox(p, text):
    p.goto(f"{BASE}/dev/outbox")
    return p.locator("li", has_text="marcus.lee@example.com").filter(has_text=text)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    p.on("dialog", lambda d: errors.append("browser pop-up: " + d.message))

    # 1) Marcus follows and picks his updates: everything except open games.
    login(p, "Marcus")
    p.goto(f"{BASE}/f/t-strikers")
    expect(p.get_by_role("region", name="Your updates")).to_have_count(0)
    p.get_by_role("button", name="Follow").click()
    ups = p.get_by_role("region", name="Your updates")
    expect(ups).to_be_visible()
    for t in ["Open games", "New fixtures", "Results", "Team news"]:
        expect(ups.get_by_role("checkbox", name=re.compile(t))).to_be_checked()
    ups.get_by_role("checkbox", name=re.compile("Open games")).uncheck()
    expect(ups.get_by_role("status")).to_have_text("Saved.")
    p.screenshot(path="/tmp/claude-0/follower-updates.png", full_page=True)
    p.reload()
    expect(p.get_by_role("region", name="Your updates").get_by_role("checkbox", name=re.compile("Open games"))).not_to_be_checked()

    # 2) Priya posts a drop-in: Marcus isn't told.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/e/new")
    p.get_by_role("radio", name="Drop-in").click()
    p.fill("#title", "Quiet pickup"); p.fill("#date", day); p.fill("#startTime", "20:00"); p.fill("#endTime", "21:00")
    p.fill("#venueName", "Invista Centre"); p.fill("#price", "0"); p.fill("#capacity", "10"); p.fill("#memberSpots", "0")
    p.get_by_role("button", name="Post drop-in").click()
    p.wait_for_url(re.compile(r"/s/[0-9a-f-]{36}\?posted=1"))
    expect(outbox(p, "Quiet pickup")).to_have_count(0)

    # 3) A new match reaches him as a fixture.
    p.goto(f"{BASE}/t/t-strikers/e/new")
    p.get_by_role("radio", name="Match").click()
    p.fill("#opponent", "Follower Test FC"); p.fill("#date", day)
    p.get_by_role("button", name="Add match").click()
    p.wait_for_url(re.compile(r"/e/[^/?]+\?created=1"))
    expect(outbox(p, "New fixture").filter(has_text="Follower Test FC").first).to_be_visible()

    # 4) Team news from the Share tab.
    p.goto(f"{BASE}/t/t-strikers/share")
    news = p.get_by_role("region", name="Post to your followers")
    news.get_by_label("Your news").fill("Trial day this Saturday, all welcome!")
    news.get_by_role("button", name="Send to followers").click()
    expect(news.get_by_role("status")).to_have_text("Sent to 1 follower.")
    p.screenshot(path="/tmp/claude-0/follower-news.png", full_page=True)
    expect(outbox(p, "Trial day this Saturday").first).to_be_visible()

    # 5) The team stops sharing results: Marcus can't pick them.
    p.goto(f"{BASE}/t/t-strikers/settings")
    fol = p.get_by_role("region", name="Followers")
    expect(fol.get_by_label("Anyone can find and follow this team")).to_be_checked()
    fol.get_by_role("checkbox", name=re.compile("^Results")).uncheck()
    p.screenshot(path="/tmp/claude-0/follower-settings.png", full_page=True)
    p.get_by_role("button", name=re.compile("^Save")).first.click()
    p.wait_for_timeout(1200)
    login(p, "Marcus")
    p.goto(f"{BASE}/f/t-strikers")
    ups = p.get_by_role("region", name="Your updates")
    expect(ups.get_by_role("checkbox")).to_have_count(3)
    expect(ups.get_by_role("checkbox", name=re.compile("^Results"))).to_have_count(0)
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("follower_updates: all checks pass")
