"""Catches the emails Auth sends (sign-in links) and appends them to mail.jsonl."""
import asyncio, json, sys, email
from aiosmtpd.controller import Controller
OUT = sys.argv[1]
class H:
    async def handle_DATA(self, server, session, envelope):
        msg = email.message_from_bytes(envelope.content)
        body = ""
        for part in (msg.walk() if msg.is_multipart() else [msg]):
            if part.get_content_type() in ("text/html", "text/plain"):
                body += part.get_payload(decode=True).decode("utf-8", "replace")
        with open(OUT, "a") as f:
            f.write(json.dumps({"to": envelope.rcpt_tos, "subject": msg["Subject"], "body": body}) + "\n")
        return "250 OK"
c = Controller(H(), hostname="127.0.0.1", port=2500); c.start()
print("mail sink on :2500", flush=True)
asyncio.get_event_loop().run_forever()
