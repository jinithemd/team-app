# Sample-data build: following teams like a social app. Find a team lists teams to follow, any
# team can be followed from there or from search, and Home shows what the followed teams are up to.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    p.goto(f"{BASE}/login")
    p.locator("form", has_text="Priya").first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

    # Home before following anything: a nudge to find teams.
    feed = p.get_by_role("region", name="Teams you follow")
    expect(feed).to_contain_text("Follow any team")

    # 1) Teams to follow, before searching. Her own team is marked, not followable.
    p.goto(f"{BASE}/teams/search")
    sug = p.get_by_role("region", name="Teams to follow")
    expect(sug).to_be_visible()
    expect(sug.locator("li", has_text="Kingston Strikers")).to_contain_text("Your team")
    sug.get_by_role("button", name="Follow Limestone City First Team").click()
    expect(sug.get_by_role("button", name="Following Limestone City First Team. Unfollow")).to_be_visible()
    p.screenshot(path="/tmp/claude-0/follow-suggest.png", full_page=True)

    # 2) Search: Follow sits on every result next to Ask to join.
    p.fill("#q", "Limestone"); p.get_by_role("button", name="Search").click()
    p.wait_for_url(re.compile(r"q=Limestone"))
    expect(p.get_by_role("button", name="Following Limestone City First Team. Unfollow")).to_be_visible()
    expect(p.get_by_text(re.compile(r"1 follower\b")).first).to_be_visible()

    # 3) Home: the followed team's games and results.
    p.goto(f"{BASE}/")
    feed = p.get_by_role("region", name="Teams you follow")
    expect(feed).to_contain_text("Limestone City First Team")
    p.screenshot(path="/tmp/claude-0/follow-home.png", full_page=True)
    feed.get_by_role("link").filter(has_text="Limestone City First Team").first.click()
    p.wait_for_url(re.compile(r"/f/t-first"))

    # 4) Unfollow from the fan page: gone from Home.
    p.get_by_role("button", name="Following").click()
    expect(p.get_by_role("button", name="Follow")).to_be_visible()
    p.goto(f"{BASE}/")
    expect(p.get_by_role("region", name="Teams you follow")).to_contain_text("Follow any team")
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("following: all checks pass")
