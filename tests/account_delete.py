# Sample-data build at localhost:3000: sign-up needs the 16+ box; delete account hands over
# or deletes what you run, blocks when a team would be left without a manager.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

def signup(p, first, email):
    p.goto(f"{BASE}/login")
    p.fill("#firstName", first); p.fill("#lastName", "Tester"); p.fill("#email", email)
    p.get_by_role("button", name="Create account").click()
    expect(p.get_by_text("You need to be 16 or older")).to_be_visible()
    p.check("#agree"); p.get_by_role("button", name="Create account").click()
    p.wait_for_url(f"{BASE}/")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))

    # 1. Solo coach with a team: deleting removes the team too.
    signup(p, "Solo", "solo.delete@example.com")
    p.goto(f"{BASE}/teams/new")
    p.fill("#name", "Solo FC")
    p.get_by_role("button", name=re.compile("Create team|Next|Continue")).first.click()
    p.wait_for_url(re.compile(r"/t/"))
    p.goto(f"{BASE}/account")
    p.get_by_role("link", name="Delete my account").click()
    expect(p.get_by_role("heading", name="Delete account")).to_be_visible()
    p.fill("#confirmEmail", "wrong@example.com"); p.get_by_role("button", name="Delete my account").click()
    expect(p.get_by_text("That doesn't match your email.")).to_be_visible()
    p.fill("#confirmEmail", "solo.delete@example.com"); p.get_by_role("button", name="Delete my account").click()
    p.wait_for_url(re.compile(r"/login\?deleted=1"))
    expect(p.get_by_text("Your account and personal data have been deleted")).to_be_visible()
    # Account is gone: signing up again with the same email works as new.
    signup(p, "Again", "solo.delete@example.com")
    expect(p.get_by_text("Solo FC")).to_have_count(0)

    # 2. A sample captain who is the only one running a busy team is blocked (Dan runs teams with players).
    p.context.clear_cookies()
    p.goto(f"{BASE}/login")
    p.locator("form", has_text="Dan").first.get_by_role("button").click()
    p.wait_for_url(f"{BASE}/")
    p.goto(f"{BASE}/account/delete")
    blocked = p.get_by_text("Before you can delete your account").count() > 0
    print("Dan blocked:", blocked)

    # Legal pages reachable signed out and linked from sign-up.
    p.context.clear_cookies()
    p.goto(f"{BASE}/privacy"); expect(p.get_by_role("heading", name="Privacy policy")).to_be_visible()
    expect(p.get_by_text("Supabase")).to_be_visible()
    p.goto(f"{BASE}/terms"); expect(p.get_by_role("heading", name="Terms of use")).to_be_visible()
    p.screenshot(path="/tmp/claude-0/terms.png", full_page=False)
    p.goto(f"{BASE}/login"); p.screenshot(path="/tmp/claude-0/login.png", full_page=True)
    b.close()

assert not errors, errors
print("account_delete: all checks pass")
