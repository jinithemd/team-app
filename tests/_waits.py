"""In-app navigations don't always fire a full page 'load', so waiting for it can time out.
Wait for the address to change, then for the network to go quiet."""
from playwright.sync_api import Page

_orig = Page.wait_for_url

def _wait_for_url(self, url, **kw):
    kw.setdefault("wait_until", "commit")
    _orig(self, url, **kw)
    try:
        self.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass

Page.wait_for_url = _wait_for_url
