# Sample-data build: groups. Priya (Strikers captain) makes "Sunday Fun", adds Marcus (not on the
# team) by email and Sam from the team, chats, and posts a game to just the group. Marcus sees
# the group in Chat, replies and books; Rahul (on the team, not in the group) can't see the game.
import re
from datetime import date, timedelta
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []
day = (date.today() + timedelta(days=5)).isoformat()

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto").new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    p.on("dialog", lambda d: errors.append("browser pop-up: " + d.message))

    # 1) Priya makes the group from the Roster tab.
    login(p, "Priya")
    p.goto(f"{BASE}/t/t-strikers/roster")
    p.get_by_role("link", name=re.compile("^Groups")).click()
    p.wait_for_url(re.compile(r"/t/t-strikers/groups$"))
    p.get_by_role("button", name="New group").click()
    p.fill("#name", "Sunday Fun"); p.fill("#about", "Sunday 9am, Caraco Park")
    p.get_by_role("button", name="Make group").click()
    p.wait_for_url(re.compile(r"/g/[0-9a-f-]{36}\?new=1"))
    gid = re.search(r"/g/([0-9a-f-]{36})", p.url).group(1)
    expect(p.get_by_role("heading", name="Sunday Fun")).to_be_visible()

    # 2) Add Marcus by email (not on the team) and Sam from the team list.
    p.get_by_role("link", name=re.compile(r"^People")).click()
    p.fill("#gp-q", "marcus.lee@example.com")
    p.get_by_role("button", name="Add Marcus Lee").click()
    expect(p.get_by_role("status")).to_have_text("Added 1 person.")
    p.get_by_text(re.compile(r"^Add from your team")).click()
    p.get_by_role("checkbox", name="Sam Okafor").check()
    p.get_by_role("button", name=re.compile(r"^Add 1 to the group")).click()
    members = p.get_by_role("region", name="In this group")
    expect(members).to_contain_text("Marcus Lee")
    expect(members).to_contain_text("Sam Okafor")
    expect(members.locator("li")).to_have_count(3)
    p.screenshot(path="/tmp/claude-0/group-people.png", full_page=True)

    # 3) Chat.
    p.get_by_role("link", name="Chat", exact=True).click()
    p.fill("#group-msg", "Who's in for Sunday?")
    p.get_by_role("button", name="Send").click()
    expect(p.get_by_role("region", name="Group chat")).to_contain_text("Who's in for Sunday?")

    # 4) A game for just this group.
    p.get_by_role("link", name="Post a game for this group").click()
    p.wait_for_url(re.compile(r"/e/new\?type=dropin&group="))
    expect(p.get_by_role("radio", name=re.compile("Just Sunday Fun"))).to_be_checked()
    expect(p.locator("#memberSpots")).to_have_count(0)
    p.screenshot(path="/tmp/claude-0/group-dropin.png", full_page=True)
    p.fill("#title", "Sunday fun game"); p.fill("#date", day); p.fill("#startTime", "09:00"); p.fill("#endTime", "10:30")
    p.fill("#venueName", "Caraco Park"); p.fill("#price", "0"); p.fill("#capacity", "14")
    p.get_by_role("button", name="Post drop-in").click()
    p.wait_for_url(re.compile(r"/s/[0-9a-f-]{36}\?posted=1"))
    sid = re.search(r"/s/([0-9a-f-]{36})", p.url).group(1)
    p.goto(f"{BASE}/dev/outbox")
    expect(p.locator("li", has_text="marcus.lee@example.com").filter(has_text="Sunday Fun · Sunday fun game").first).to_be_visible()
    # Not on the team schedule, and not on the fan page.
    p.goto(f"{BASE}/t/t-strikers/schedule")
    expect(p.get_by_role("link", name=re.compile(r"^Sunday fun game"))).to_have_count(0)
    p.goto(f"{BASE}/g/{gid}")
    expect(p.get_by_role("region", name="Games for this group")).to_contain_text("Sunday fun game")

    # 5) Marcus: the group is in his Chat tab; he replies and books.
    login(p, "Marcus")
    p.goto(f"{BASE}/chat")
    grp = p.get_by_role("region", name="Groups")
    expect(grp).to_contain_text("Sunday Fun")
    expect(grp).to_contain_text("1 unread")
    grp.get_by_role("link").filter(has_text="Sunday Fun").click()
    p.wait_for_url(re.compile(rf"/g/{gid}"))
    p.fill("#group-msg", "I'm in!")
    p.get_by_role("button", name="Send").click()
    expect(p.get_by_role("region", name="Group chat")).to_contain_text("I'm in!")
    p.screenshot(path="/tmp/claude-0/group-chat.png", full_page=True)
    expect(p.get_by_role("link", name=re.compile(r"^People"))).to_be_visible()
    expect(p.get_by_role("link", name="Post a game for this group")).to_have_count(0)
    p.goto(f"{BASE}/s/{sid}")
    p.get_by_role("button", name=re.compile(r"^Book")).first.click()
    expect(p.get_by_text(re.compile("You're in|You've got a spot", re.I)).first).to_be_visible()

    # 6) Rahul is on the team but not in the group: no game, no group.
    login(p, "Rahul")
    p.goto(f"{BASE}/s/{sid}")
    expect(p.get_by_role("heading", name="We couldn't find that page")).to_be_visible()
    p.goto(f"{BASE}/g/{gid}")
    expect(p.get_by_role("heading", name="We couldn't find that page")).to_be_visible()
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("groups: all checks pass")
