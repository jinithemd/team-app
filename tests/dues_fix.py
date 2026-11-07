# Sample-data build: the treasurer fixes the Payments tab. Export hands over the file without
# leaving the page; a player can be marked paid, the payment undone, taken off a fee; a fee deleted.
import re
import _waits  # noqa: F401
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
errors = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto", accept_downloads=True)
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)[:120]))
    p.on("dialog", lambda d: errors.append("browser pop-up: " + d.message))
    p.goto(f"{BASE}/login")
    p.locator("form", has_text="Priya").first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

    # A fee for everyone.
    p.goto(f"{BASE}/t/t-strikers/dues")
    p.get_by_role("button", name="Add a fee").click()
    p.fill("#fee-name", "Training kit"); p.fill("#fee-amount", "20")
    p.get_by_role("button", name="Add fee").click()
    expect(p.get_by_role("status")).to_contain_text("Added for")
    p.reload()

    # 1) Export downloads on a computer and the page stays put.
    with p.expect_download() as dl:
        p.get_by_role("link", name="Export to a spreadsheet").click()
    assert dl.value.suggested_filename.endswith(".csv"), dl.value.suggested_filename
    assert p.url.endswith("/t/t-strikers/dues"), p.url

    # 2) Tap a player: mark paid, then undo it.
    players = p.get_by_role("region", name=re.compile("Players")) if p.get_by_role("region", name="Players").count() else p.locator("section[aria-labelledby='players-h']")
    row = players.locator("details").filter(has=p.locator("summary", has_text="Rahul")).first
    row.locator("summary").click()
    undo = row.get_by_role("button", name=re.compile(r"^Undo"))
    n = undo.count()
    row.get_by_role("button", name="Mark paid ($20 cash)").click()
    expect(undo).to_have_count(n + 1, timeout=10000)
    expect(row.get_by_role("button", name="Mark paid ($20 cash)")).to_have_count(0)
    p.screenshot(path="/tmp/claude-0/dues-player-open.png", full_page=True)
    row.get_by_role("button", name="Undo $20 payment from Rahul").click()
    row.get_by_role("button", name="Undo payment").click()
    expect(undo).to_have_count(n, timeout=10000)
    expect(row.get_by_role("button", name="Mark paid ($20 cash)")).to_have_count(1)

    # 3) Take Rahul off the kit fee.
    before = players.locator("details").count()
    kit = row.get_by_role("button", name="Remove Rahul from Training kit")
    kit.click(); row.get_by_role("button", name="Yes, remove").click()
    expect(row.get_by_role("button", name="Remove Rahul from Training kit")).to_have_count(0, timeout=10000)

    # 4) Delete the fee: it's gone from the list.
    fees = p.get_by_role("list", name="Fees")
    fees.get_by_role("button", name="Delete Training kit").click()
    p.screenshot(path="/tmp/claude-0/dues-fee-confirm.png", full_page=True)
    fees.get_by_role("button", name="Yes, delete it").click()
    expect(p.get_by_text(re.compile(r"^Training kit:"))).to_have_count(0, timeout=10000)
    b.close()

assert not [e for e in errors if "#418" not in e], errors
print("dues_fix: all checks pass")
