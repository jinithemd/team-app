# Sample-data build: online payments. Payout account setup, a treasurer collecting dues by
# card, a per-event fee (card and cash), and a tournament entry fee paid by card.
import re
import _waits  # noqa: F401
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

def login(p, who):
    p.context.clear_cookies(); p.goto(f"{BASE}/login")
    p.locator("form", has_text=who).first.get_by_role("button").click(); p.wait_for_url(f"{BASE}/")

def no_sideways(p, where):
    w = p.evaluate("document.documentElement.scrollWidth")
    assert w <= 391, f"sideways scroll on {where}: {w}"

def pay_on_card_page(p):
    p.wait_for_url(re.compile(r"/pay/[0-9a-f-]{36}"))
    expect(p.get_by_text("Sample build: this is where Stripe")).to_be_visible()
    p.get_by_role("button", name=re.compile(r"^Pay \$")).click()
    expect(p.get_by_text("Payment received.")).to_be_visible()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Toronto")
    ctx.route("https://photon.komoot.io/**", lambda r: r.abort())
    ctx.route(re.compile(r"https://.*(openstreetmap|cartocdn|arcgisonline).*"), lambda r: r.abort())
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(p.url + " " + str(e)[:80]))

    # 1) Before anyone collects, players only see the e-Transfer way.
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-reserves/dues")
    expect(p.get_by_text("$40 left to pay")).to_be_visible()
    expect(p.get_by_role("button", name=re.compile("Pay by card"))).to_have_count(0)

    # 2) Aisha (Reserves treasurer) sets up her payout account and turns online payments on.
    login(p, "Aisha")
    p.goto(f"{BASE}/t/t-reserves/dues")
    panel = p.get_by_role("region", name="Online payments")
    expect(panel).to_contain_text("Let players pay dues and game fees by card")
    panel.get_by_role("link", name="Set up your payout account").click()
    p.wait_for_url(f"{BASE}/account/payouts")
    expect(p.get_by_text("You don't need a business or a business number.")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/payouts-setup.png", full_page=True)
    no_sideways(p, "payouts")
    p.get_by_role("button", name="Finish payout setup (sample)").click()
    expect(p.get_by_text("Your payout account is ready.")).to_be_visible()
    p.goto(f"{BASE}/t/t-reserves/dues")
    p.get_by_role("button", name="Turn on: collect into my account").click()
    expect(p.get_by_role("region", name="Online payments")).to_contain_text("On.")
    expect(p.get_by_role("region", name="Online payments")).to_contain_text("your payout account")

    # 3) Rahul pays what's left by card: $40 + $2.18 fee. It's ticked off by itself.
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-reserves/dues")
    btn = p.get_by_role("button", name="Pay by card · $42.18")
    expect(btn).to_be_visible()
    expect(p.get_by_text("$40.00 + $2.18 online fee")).to_be_visible()
    p.screenshot(path=f"{SHOTS}/dues-pay.png", full_page=True)
    btn.click()
    expect(p.get_by_text("Online fee")).to_be_visible()
    pay_on_card_page(p)
    p.screenshot(path=f"{SHOTS}/pay-receipt.png", full_page=True)
    p.get_by_role("link", name="Done").click()
    p.wait_for_url(f"{BASE}/t/t-reserves/dues")
    expect(p.get_by_text("$0 left to pay")).to_be_visible()
    expect(p.get_by_role("button", name=re.compile("Pay by card"))).to_have_count(0)
    # The treasurer sees him paid; no confirming needed.
    login(p, "Aisha")
    p.goto(f"{BASE}/t/t-reserves/dues?show=paid")
    expect(p.locator("li", has_text="Rahul")).to_contain_text("Paid")

    # 4) A training with a $10 fee. Marcus (captain) adds it and says he's going.
    login(p, "Marcus")
    p.goto(f"{BASE}/t/t-reserves/e/new?type=training")
    p.fill("#date", "2026-12-03")
    p.fill("#fee", "10")
    p.get_by_role("button", name="Add training").click()
    p.wait_for_url(re.compile(r"/e/[^/?]+\?created=1"))
    ev = re.search(r"/e/([^/?]+)\?", p.url).group(1)
    fee = p.get_by_role("region", name="Fee: $10.00 per player")
    expect(fee).to_be_visible()
    expect(fee.get_by_role("button", name="Pay by card · $11.22")).to_be_visible()
    p.get_by_role("region", name="Are you in?").get_by_role("button", name=re.compile("^Going")).first.click()
    expect(p.get_by_role("region", name="Are you in?").get_by_role("button", name=re.compile("^Going")).first).to_have_attribute("aria-pressed", "true")
    p.reload()
    # He paid cash at the field: tick himself off.
    fee = p.get_by_role("region", name="Fee: $10.00 per player")
    fee.get_by_role("button", name="Mark Marcus Lee as paid cash").click()
    expect(fee.get_by_role("button", name=re.compile("paid cash. Untick"))).to_be_visible()
    expect(fee).to_contain_text("1 of 1 paid")
    p.screenshot(path=f"{SHOTS}/event-fee-staff.png", full_page=True)
    # Rahul pays his by card.
    login(p, "Rahul")
    p.goto(f"{BASE}/t/t-reserves/e/{ev}")
    p.get_by_role("region", name="Fee: $10.00 per player").get_by_role("button", name="Pay by card · $11.22").click()
    pay_on_card_page(p)
    p.goto(f"{BASE}/t/t-reserves/e/{ev}")
    expect(p.get_by_text("You've paid. Thanks!")).to_be_visible()
    login(p, "Marcus")
    p.goto(f"{BASE}/t/t-reserves/e/{ev}")
    fee = p.get_by_role("region", name="Fee: $10.00 per player")
    expect(fee.locator("li", has_text="Rahul")).to_contain_text("Paid · card")
    expect(fee).to_contain_text("2 of 2 paid")

    # 5) Tournament entry fee by card. Dan hosts with a $50 fee, collects into his account,
    #    and invites the Reserves; Marcus accepts and pays $52.50.
    login(p, "Dan")
    p.goto(f"{BASE}/account/payouts")
    p.get_by_role("button", name="Finish payout setup (sample)").click()
    expect(p.get_by_text("Your payout account is ready.")).to_be_visible()
    p.goto(f"{BASE}/tournaments/new")
    p.fill("#name", "Card Cup")
    p.get_by_role("radio", name=re.compile("^Knockout")).click()
    p.fill("#startsOn", "2026-12-12"); p.fill("#endsOn", "2026-12-12")
    p.fill("#fee", "50")
    p.get_by_role("button", name="Create tournament").click()
    p.wait_for_url(re.compile(r"/tournaments/[^/]+/teams\?created=1"))
    tid = re.search(r"/tournaments/([^/]+)/teams", p.url).group(1)
    p.fill("#team-q", "Reserves"); p.get_by_role("button", name="Search").click(); p.wait_for_url(re.compile(r"q=Reserves")); p.wait_for_load_state("networkidle")
    p.locator("li", has_text="Limestone City Reserves").get_by_role("button", name="Invite").click()
    expect(p.get_by_text("Invited", exact=True)).to_be_visible()
    login(p, "Marcus")
    p.goto(f"{BASE}/tournaments")
    p.get_by_role("button", name="Accept for Limestone City Reserves").click()
    expect(p.get_by_role("heading", name="Playing in")).to_be_visible()
    login(p, "Dan")
    p.goto(f"{BASE}/tournaments/{tid}/teams")
    tpanel = p.get_by_role("region", name="Online payments")
    tpanel.get_by_role("button", name="Turn on: collect into my account").click()
    expect(p.get_by_role("region", name="Online payments")).to_contain_text("On.")
    expect(p.locator("#fees")).to_contain_text("Teams can pay by card in the app")
    expect(p.locator("#fees")).to_contain_text("0 of 1 paid")
    login(p, "Marcus")
    p.goto(f"{BASE}/tournaments/{tid}")
    tb = p.get_by_role("button", name="Pay entry fee · $52.50")
    expect(tb).to_be_visible()
    p.screenshot(path=f"{SHOTS}/tournament-pay.png", full_page=True)
    no_sideways(p, "tournament overview")
    tb.click()
    pay_on_card_page(p)
    p.goto(f"{BASE}/tournaments/{tid}")
    expect(p.get_by_text("fee paid")).to_be_visible()
    expect(p.get_by_role("button", name=re.compile("Pay entry fee"))).to_have_count(0)
    login(p, "Dan")
    p.goto(f"{BASE}/tournaments/{tid}/teams")
    expect(p.locator("#fees")).to_contain_text("1 of 1 paid")
    # Dan's payout page counts what's come in.
    p.goto(f"{BASE}/account/payouts")
    expect(p.get_by_text("You've received $50.00 from 1 payment.")).to_be_visible()

    b.close()

real = [e for e in errors if "#418" not in e]
assert not real, real
print("payments: all checks pass")
