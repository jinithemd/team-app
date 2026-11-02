# TeamSnap: what users hate, what's missing, and what Clbx does about it

Collected 2026-11-01. **133 review excerpts from 5 sources:** Trustpilot (60), Capterra (50), G2 (10), TrustRadius (9), App Store (4).
Ranked with `reviews.py` and a TeamSnap theme file (`replica/themes-teamsnap.json`); full output in `replica/feedback.md`, raw rows in `replica/reviews.csv`.

**Limits of this sample (read before trusting the numbers)**
- Quotes are verbatim **excerpts** (the reading tool returns at most ~125 characters of a review), not whole reviews. Every one links to its page.
- **Google Play reviews and Reddit could not be read** from here: no review text was reachable through the tools available. The App Store page showed only 4 reviews. So there are only 4 app-store reviews in the sample.
- Trustpilot is a complaints-heavy site (TeamSnap scores 1.1/5 there from 694 reviews, against 4.8/5 from 60K ratings on the App Store and 4.2/5 from 157 on Capterra). Its recent 1-star reviews are real, but they are not what the typical user feels.
- About half the Trustpilot rows are from 2018–2019; `reviews.py` weights recent reviews higher.
- TrustRadius scores (out of 10) were halved to fit a 5-star scale. Some 2018 Trustpilot rows have no star rating shown.
- Themes with fewer than 3 reviews or one source are marked **thin**.

---

## 1. What they hate

| # | Problem | Reviews | Sources | Clbx today |
|---|---|---|---|---|
| 1 | **No human support**: no phone, slow email-only replies, no way to reach anyone | 13 (+7 overlap) | 3 | **Gap.** There's no "contact us" in the app. |
| 2 | **Ads and upsells**: ads after every message, pushing the ad-free plan, spam surveys | 10 (+7) | 3 | **Solved.** Clbx has no ads and no upsell prompts. |
| 3 | **Accounts and households**: can't delete an account, household invite loops, login rejected, password links expired | 8 | 4 | **Mostly solved.** Sign-in is by emailed link, no passwords, and there's self-serve deletion under Account. There are no household accounts (adult teams don't need them). |
| 4 | **Price and paywalls**: core features like availability and stats only on paid plans | 10 | 3 | **Solved for players.** Availability, chat, stats and RSVPs are all free. |
| 5 | **Payment fees**: admin fee plus "convenience fee" on electronic payments, merchant fees eat dues | 8 | 3 | **Partly the same.** Clbx adds 3.2% + 90¢ on top. Cash and e-transfer are marked by hand with no fee. |
| 6 | **Forced on members by the club**: "forces you onto a smartphone", messages don't reach people without the app | 5 | 2 | **Mostly solved.** Every notice also goes by email, with one-tap RSVP links that work without signing in. |
| 7 | **Messaging is clunky**: no unread badge, can't add people to a group chat, notifications vanish | 16 | 4 | **Solved.** Team chat with unread counts; push alerts once notifications are switched on. |
| 8 | **Schedule and calendar**: unclear how to get games into a phone calendar, no week/month view, odd list order | 7 | 4 | **Mostly solved.** There's a calendar subscription feed and a Calendar tab. A week/month grid isn't checked yet. |
| 9 | **TeamSnap ONE took features away** (invoicing, auto-rostering, mobile admin) | 3 | 2 | n/a. Opportunity for clubs that are switching now. |
| 10 | **Billing surprises**: charged a full year after quitting, $600 charge, card expiry shut the club down | 4 | 2 | **Not applicable yet.** Clbx has no subscription; keep it that way or bill monthly. |

Quotes:
- "There appears to be ABSOLUTELY NO WAY TO CONTACT TEAM SNAP that I can find in the app or on their website." ([Trustpilot, 1★](https://nl-be.trustpilot.com/reviews/68c464eebde333dedf658eb0))
- "When running an organization an administrator needs the ability to talk to a support person" ([Capterra, 3★](https://www.capterra.com/p/123208/TeamSnap/reviews/?page=2))
- "Now Teamsnap tries to sell you their add free version every time you open the app." ([Trustpilot, 1★](https://nl-be.trustpilot.com/reviews/669432ef1536be87478a78d9))
- "The ads everytime you close out a message can get irritating." ([Capterra, 4★](https://www.capterra.com/p/123208/TeamSnap/reviews/?page=2))
- "they have kept me in an endless loop of not being able to delete my account." ([Trustpilot, 1★](https://nl-be.trustpilot.com/reviews/674017d218b7dc86dc24523d))
- "This app sucks. Not only does it charge an unreasonable admin fee it also charges a convenience fee for electronic payments." ([Trustpilot, 1★](https://nl-be.trustpilot.com/reviews/6ab43464ec7d228e1ff56cbc))
- "I wish that non profits could get lower fees. Especially, on merchant fees. It does cut in to our dues" ([Capterra, 5★](https://www.capterra.com/p/123208/TeamSnap/reviews/))
- "I absolutely hate this app. It forces you onto a smartphone 24/7." ([Trustpilot, 1★](https://dk.trustpilot.com/review/teamsnap.com?page=6))
- "TeamSnap will not deliver the message if the recipient does not have the app downloaded on their device." ([Capterra, 3★](https://www.capterra.com/p/123208/TeamSnap/reviews/))

## 2. What's missing (asked for by name)

| # | Request | Reviews | Sources | Clbx today |
|---|---|---|---|---|
| 1 | **Stats and scorekeeping** in the app | 8 | 3 | **Have it.** Live match scoring, scorers, player of the match, tournament tables. |
| 2 | **Availability included free**, and set once for all teams | 4 | 2 | **Have it.** Free, and "Unavailable dates" covers every team at once. |
| 3 | **Tell the coach when someone says they can't come** | 1 (**thin**) | 1 | **Gap.** Staff have to look. |
| 4 | **Polls and sign-up lists** (snacks, volunteers) | 1 (**thin**) | 1 | Polls: **have it** (in chat). Sign-up lists: **gap**. |
| 5 | **Cleaner calendar: week / month / day** | 1 (**thin**) | 1 | To check. |
| 6 | **Hold the roster until coaches finish draft calls** | 1 (**thin**) | 1 | **Gap**, but niche (youth leagues). |
| 7 | **Jersey colour / home-away in the event summary** | 1 (**thin**) | 1 | Home/away is shown. Kit colour: **gap**. |
| 8 | **Reminder schedule control** (e.g. every other week) | 1 (**thin**) | 1 | Fixed reminders. |

Quotes:
- "I don't particularly appreciate how they do not keep stats in the app." ([G2, 3.5★](https://g2.com/products/teamsnap/reviews_and_filters?page=2))
- "You need to pay for a lot of the upgrades, including "availability"" ([Capterra, 4★](https://www.capterra.com/p/123208/TeamSnap/reviews/))
- "I have to do it separately for each team so I'm looking for something else." ([Trustpilot, 1★](https://dk.trustpilot.com/reviews/5cca4094a843690a7cccc186))
- "I wish I would get notified if someone says they will not be at an event or practice instead having to look in the app." ([Capterra, 5★](https://www.capterra.com/p/123208/TeamSnap/reviews/))
- "Not aware of any feature to poll members for specific items. Signup lists are also managed outside of the app." ([Capterra, 4★](https://www.capterra.com/p/123208/TeamSnap/reviews/))
- "I would love a cleaner calendar view. Maybe view events by week, by month or by day." ([G2, 5★](https://g2.com/products/teamsnap/reviews_and_filters?page=2))

## 3. What's unsolved (whole groups the app serves badly)

- **Adult and rec teams** get a youth-sports product: households, guardians and waivers they don't need, plus the ads and fees. One 2019 reviewer used it "in an adult league softball team" ([Trustpilot, 5★](https://dk.trustpilot.com/reviews/5cca482fa8436908c411ced4)); most complaints come from parents. **Thin as direct evidence**, but it's exactly Clbx's market.
- **Members the club forces onto the app**: people who didn't choose it and don't want another app (5 reviews, 2 sources). They need it to work from email.
- **Small clubs that need a human**: organisation admins with no phone line (support theme, 13 reviews, 3 sources).

---

## Fix plan for Clbx

Picked by evidence × how cheap it is. "Have it" items aren't on this list; they go into the positioning instead.

| # | Change | Size | Evidence | Status |
|---|---|---|---|---|
| 1 | **Help & contact in the app.** "Get help" under Account and on every error page: a short form that emails you (and later lists in the owner dashboard), with a promised reply time ("a real person replies within a day"). | S | Support: 13 reviews, 3 sources (+7) | todo |
| 2 | **Fee choice for clubs.** When setting dues or a fee, let the club choose "players pay the fee" (today) or "club covers the fee"; always show the fee before paying; keep cash/e-transfer free. Pricing itself goes to `/replica-launch`. | S | Fees: 8 reviews, 3 sources | todo |
| 3 | **Drop-out alerts for captains.** Push/email the captain and managers when someone switches to "can't make it" within 48 hours of an event (one message, not one per change). | S | 1 review (**thin**), but cheap and it's a core captain pain | todo |
| 4 | **No-app members get the same deal.** Check that every notice (new event, change, cancel, chat mention) reaches email-only members with one-tap answers; add a "You don't need the app" line to invites. | S | Forced-on-members: 5 reviews, 2 sources | todo (audit) |
| 5 | **Sign-up lists** on events (bring the ball, snacks, ref, drive): "I'll do it" slots. | M | 1 review (**thin**); polls already exist | later |
| 6 | **Calendar week/month view** plus a more visible "add to my phone calendar" on the Schedule tab. | M | Schedule: 7 reviews, 4 sources | todo (check what Calendar shows first) |
| 7 | **Kit colour on events** (home/away kit shown in the list and in the reminder email). | S | 1 review (**thin**) | later |
| 8 | **Keep it ad-free and never lock features behind upgrades for players.** Not a build; a rule for `/replica-launch`. | – | Ads 10+7, paywalls 10 | rule |

---

## The angle

**A. No ads, nothing locked**
For adult teams who are sick of ads and paywalls in their team app, Clbx is ad-free, with availability, chat and stats free for every player.
Evidence: ads/upsells 10 (+7) and price/paywalls 10 reviews, across 3 sources.

**B. Works for the players who never wanted an app**
For captains whose players won't install another app, Clbx works from email: every notice has one-tap "I'm in / Can't make it", and the app is optional.
Evidence: forced-on-members 5 reviews across 2 sources; the "won't deliver without the app" complaint.

**C. A real person answers**
For small clubs who can't get anyone on the phone, Clbx is run by someone in Kingston who answers within a day.
Evidence: no-human-support 13 reviews across 3 sources (+7). Strong evidence, but it only holds while support volume is small.

**Recommendation: A, with B as the second line.** A is the most evidence-backed, and it's true today with no new work. B speaks to the captain, who is the person choosing the app. C is real, but it's a promise that gets harder as Clbx grows; use it in the help page (fix 1), not the headline.

Don't name TeamSnap in the app, ads or store listing. A factual comparison page is a question for a lawyer.
