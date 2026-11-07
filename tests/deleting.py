# Sample-data build: past events sit folded under "Past events" on the schedule; a captain can
# delete a past event (it has Edit again) and a drop-in game (from its session page).
import re
from datetime import date, timedelta
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    p.on("dialog", lambda d: d.accept())
    login(p, "Priya")

    # 1) Past events are folded away until you open them.
    p.goto(f"{BASE}/t/t-strikers/schedule")
    past = p.locator("details", has=p.locator("summary", has_text="Past events"))
    expect(past).to_have_count(1)
    expect(past.locator("a[href*='/e/']").first).not_to_be_visible()
    p.screenshot(path="/tmp/claude-0/schedule-past-closed.png", full_page=True)
    past.locator("summary").click()
    first = past.locator("a[href*='/e/']").first
    expect(first).to_be_visible()
    p.screenshot(path="/tmp/claude-0/schedule-past-open.png", full_page=True)
    n_before = past.locator("a[href*='/e/']").count()

    # 2) A past event can be edited or deleted again.
    first.click(); p.wait_for_url(re.compile(r"/t/t-strikers/e/[^/]+$"))
    eid = p.url.rsplit("/", 1)[1]
    p.get_by_role("link", name="Edit or delete").click()
    p.wait_for_url(re.compile(r"/edit$"))
    dl = p.locator("section[aria-labelledby='del-h']")
    dl.get_by_role("button", name="Delete this event").click()
    if dl.get_by_label("Only this one").count():
        dl.get_by_label("Only this one").check()
    dl.get_by_role("button", name="Delete", exact=True).click()
    p.wait_for_url(re.compile(r"/t/t-strikers/schedule\?deleted=1"))
    p.goto(f"{BASE}/t/t-strikers/e/{eid}")
    expect(p.get_by_role("heading", name="We couldn't find that page")).to_be_visible()

    # 3) A drop-in game: deleted from its session page, gone from the schedule.
    day = (date.today() + timedelta(days=3)).isoformat()
    p.goto(f"{BASE}/t/t-strikers/e/new")
    p.get_by_role("radio", name="Drop-in").click()
    p.fill("#title", "Delete me pickup")
    p.fill("#date", day); p.fill("#startTime", "20:00"); p.fill("#endTime", "21:00")
    p.fill("#venueName", "Invista Centre")
    p.fill("#price", "0"); p.fill("#capacity", "10"); p.fill("#memberSpots", "0")
    p.get_by_role("button", name="Post drop-in").click()
    p.wait_for_url(re.compile(r"/s/[0-9a-f-]{36}\?posted=1"))
    p.goto(f"{BASE}/t/t-strikers/schedule")
    card = p.get_by_role("link", name=re.compile(r"^Delete me pickup, Drop-in"))
    expect(card).to_be_visible()
    card.click(); p.wait_for_url(re.compile(r"/t/t-strikers/e/"))
    p.get_by_role("link", name="Manage drop-in").click()
    p.wait_for_url(re.compile(r"/s/[0-9a-f-]{36}"))
    p.get_by_role("button", name="Delete session").click()
    p.wait_for_url(re.compile(r"/t/t-strikers/schedule\?deleted=1"))
    expect(p.get_by_role("link", name=re.compile(r"^Delete me pickup"))).to_have_count(0)
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("deleting: all checks pass")
