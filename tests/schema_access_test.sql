\set ON_ERROR_STOP 0
\set QUIET 1
-- people
insert into auth.users values ('00000000-0000-0000-0000-0000000000a0'),('00000000-0000-0000-0000-0000000000c0'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000b2'),('00000000-0000-0000-0000-0000000000b3'),('00000000-0000-0000-0000-0000000000e0'),('00000000-0000-0000-0000-0000000000f0');
insert into profiles(id,first_name,last_name,email) values
 ('00000000-0000-0000-0000-0000000000a0','Owen','Owner','o@x'),('00000000-0000-0000-0000-0000000000c0','Cap','Tain','c@x'),
 ('00000000-0000-0000-0000-0000000000b1','Rahul','One','p1@x'),('00000000-0000-0000-0000-0000000000b2','Sana','Two','p2@x'),
 ('00000000-0000-0000-0000-0000000000b3','Tom','Three','p3@x'),('00000000-0000-0000-0000-0000000000e0','Eve','Manager','m@x'),('00000000-0000-0000-0000-0000000000f0','Tess','Treasurer','t@x');
insert into clubs(id,name,slug,created_by) values ('10000000-0000-0000-0000-000000000001','Limestone City FC','limestone-city','00000000-0000-0000-0000-0000000000a0');
insert into club_admins values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a0','owner'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f0','treasurer');
insert into teams(id,club_id,name,sport,created_by,points_enabled) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Reserves','Soccer','00000000-0000-0000-0000-0000000000a0',true);
insert into roster_members(team_id,user_id,roles,permissions,status) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c0','{captain}','{attendance,schedule_events,scoring,roster}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','{}','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','{}','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b3','{}','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e0','{}','{}','active');
insert into conversations(team_id,kind) values ('20000000-0000-0000-0000-000000000001','team'),('20000000-0000-0000-0000-000000000001','staff');
insert into events(id,team_id,type,start_at,end_at,tz,opponent,home_away) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','match','2026-10-31 18:00Z','2026-10-31 19:45Z','America/Toronto','Napanee Rovers','away'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','match','2026-11-07 18:00Z','2026-11-07 19:45Z','America/Toronto','Belleville United','home');
insert into event_managers(event_id,user_id) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e0');
set role authenticated;

\echo == RSVP
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
insert into rsvps(event_id,user_id,response) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','going');
\echo [ok] player answers for self
\echo [expect fail] player answers for a teammate:
insert into rsvps(event_id,user_id,response) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','going');

\echo == Schedule
\echo [expect fail] player adds a training:
insert into events(team_id,type,start_at,end_at,tz) values ('20000000-0000-0000-0000-000000000001','training','2026-11-03 22:00Z','2026-11-03 23:00Z','UTC');
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
insert into events(team_id,type,start_at,end_at,tz) values ('20000000-0000-0000-0000-000000000001','training','2026-11-03 22:00Z','2026-11-03 23:00Z','UTC');
\echo [ok] captain adds a training
\echo [expect fail] captain adds a match (no schedule_games permission):
insert into events(team_id,type,start_at,end_at,tz,opponent) values ('20000000-0000-0000-0000-000000000001','match','2026-11-14 18:00Z','2026-11-14 19:00Z','UTC','X');

\echo == Attendance
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo [expect fail] player records attendance:
insert into attendance values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','present');
set request.jwt.sub='00000000-0000-0000-0000-0000000000e0';
insert into attendance(event_id,user_id,status) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','present'),('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','present');
insert into attendance(event_id,user_id,status,minutes_late) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e0','late',20);
\echo [ok] event manager records attendance for their trip
\echo [expect fail] event manager records attendance for another game:
insert into attendance(event_id,user_id,status) values ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1','present');
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
insert into attendance(event_id,user_id,status) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b3','absent');
\echo [ok] captain records an absence

\echo == Availability
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
insert into availability_periods(user_id,kind,starts_on,ends_on,note) values ('00000000-0000-0000-0000-0000000000b1','injured','2026-11-01','2026-11-21','Hamstring, physio says 3 weeks');
\echo [ok] player marks self injured
set request.jwt.sub='00000000-0000-0000-0000-0000000000b2';
\echo teammate sees "unavailable" (1) but not the reason (0):
select count(*) from availability_public; select count(*) from availability_periods;
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
\echo captain sees the reason:
select kind, note from availability_periods;

\echo == Carpool
set request.jwt.sub='00000000-0000-0000-0000-0000000000b2';
insert into ride_offers(id,event_id,driver_id,seats,leaves_from) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2',1,'Cataraqui Centre');
\echo [ok] Sana offers 1 seat
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
insert into ride_requests(event_id,rider_id,offer_id,status) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','40000000-0000-0000-0000-000000000001','matched');
\echo [ok] Rahul takes the seat
set request.jwt.sub='00000000-0000-0000-0000-0000000000b3';
\echo [expect fail] Tom takes a seat in the full car:
insert into ride_requests(event_id,rider_id,offer_id,status) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b3','40000000-0000-0000-0000-000000000001','matched');

\echo == Dues
set request.jwt.sub='00000000-0000-0000-0000-0000000000f0';
insert into fees(id,team_id,name,amount_cents) values ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Season fee',12000);
insert into dues(id,fee_id,user_id,amount_cents) values ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1',12000),('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2',12000);
\echo [ok] club treasurer sets a season fee for 2 players
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo player sees only their own due (1):
select count(*) from dues;
insert into payments(id,due_id,amount_cents,method,paid_on,reported_by) values ('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',12000,'etransfer','2026-10-24','00000000-0000-0000-0000-0000000000b1');
\echo [ok] player reports an e-Transfer
\echo [expect fail] player reports a payment as already verified:
insert into payments(due_id,amount_cents,method,paid_on,reported_by,verified_by,verified_at) values ('60000000-0000-0000-0000-000000000001',100,'cash','2026-10-24','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1',now());
\echo player tries to verify their own payment (0 rows):
update payments set verified_by='00000000-0000-0000-0000-0000000000b1', verified_at=now() returning id;
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
\echo captain without payments permission sees no dues (0):
select count(*) from dues;
set request.jwt.sub='00000000-0000-0000-0000-0000000000f0';
\echo treasurer verifies (1 row):
update payments set verified_by='00000000-0000-0000-0000-0000000000f0', verified_at=now() returning method;

\echo == Player of the match
reset role; update events set potm_open=true where id='30000000-0000-0000-0000-000000000001'; set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo [expect fail] vote for yourself:
insert into potm_votes values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1');
insert into potm_votes values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2');
\echo [ok] Rahul votes for Sana
set request.jwt.sub='00000000-0000-0000-0000-0000000000b3';
\echo [expect fail] Tom (absent) votes:
insert into potm_votes values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000b2');

\echo == Points and staff chat
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo [expect fail] player gives themself points:
insert into points_ledger(team_id,user_id,points,reason,created_by) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1',50,'manual','00000000-0000-0000-0000-0000000000b1');
\echo player can read the staff chat (0):
select count(*) from conversations where kind='staff';
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
insert into points_ledger(team_id,user_id,points,reason,note,created_by) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2',5,'manual','Helped run the bake sale','00000000-0000-0000-0000-0000000000c0');
\echo [ok] captain adds manual points
\echo captain can read the staff chat (1):
select count(*) from conversations where kind='staff';

\echo == Geo check-in
reset role;
update teams set geo_checkin_enabled=true where id='20000000-0000-0000-0000-000000000001';
insert into venues(id,team_id,name,lat,lng,check_in_radius_m) values ('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Club grounds',44.2312,-76.4860,150);
insert into events(id,team_id,type,start_at,end_at,tz,venue_id) values
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','training',now()-interval '5 minutes',now()+interval '85 minutes','America/Toronto','80000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','training',now()-interval '25 minutes',now()+interval '65 minutes','America/Toronto','80000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','training',now()+interval '3 hours',now()+interval '4 hours','America/Toronto','80000000-0000-0000-0000-000000000001');
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo Rahul checks in 40 m from the pitch, 5 min after start (present):
select * from check_in('30000000-0000-0000-0000-000000000003',44.2315,-76.4858,12);
\echo checks in again from the car park later: first check-in stands (present):
select status from check_in('30000000-0000-0000-0000-000000000003',44.2318,-76.4862,10);
\echo stored row has distance and accuracy, no coordinates (geo, 12):
select method, accuracy_m from attendance where event_id='30000000-0000-0000-0000-000000000003';
\echo [expect fail] check in from home, 3 km away:
select * from check_in('30000000-0000-0000-0000-000000000004',44.2553,-76.5180,10);
\echo [expect fail] rough fix (± 900 m):
select * from check_in('30000000-0000-0000-0000-000000000004',44.2312,-76.4860,900);
\echo [expect fail] too early, 3 hours before:
select * from check_in('30000000-0000-0000-0000-000000000005',44.2312,-76.4860,10);
\echo arrives 25 min after start (late, 25):
select * from check_in('30000000-0000-0000-0000-000000000004',44.2312,-76.4860,8);
\echo [expect fail] player edits their geo row to present:
update attendance set status='present', minutes_late=null where event_id='30000000-0000-0000-0000-000000000004' returning 1;
\echo (0 rows above means blocked)
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
\echo captain marks Sana excused, then Sana checks in: captain mark stands (excused):
insert into attendance(event_id,user_id,status,recorded_by) values ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2','excused','00000000-0000-0000-0000-0000000000c0');
set request.jwt.sub='00000000-0000-0000-0000-0000000000b2';
select status from check_in('30000000-0000-0000-0000-000000000003',44.2312,-76.4860,8);
set request.jwt.sub='00000000-0000-0000-0000-0000000000a0';
\echo [expect fail] club owner not on the roster checks in:
select * from check_in('30000000-0000-0000-0000-000000000003',44.2312,-76.4860,8);
\echo captain sees both check-ins with method (2):
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
select count(*) from attendance where method='geo';

\echo == One person, many hats
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d0');
insert into profiles(id,first_name,last_name,email) values ('00000000-0000-0000-0000-0000000000d0','Jin','Founder','j@x');
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000d0';
insert into clubs(id,name,slug,created_by) values ('10000000-0000-0000-0000-000000000002','Athletic FC','athletic-fc','00000000-0000-0000-0000-0000000000d0');
reset role; insert into club_admins values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000d0','owner'); set role authenticated;
\echo [ok] founder signs up once and creates the club (owner)
insert into teams(id,club_id,name,sport,created_by) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','First Team','Soccer','00000000-0000-0000-0000-0000000000d0');
insert into roster_members(team_id,user_id,is_player,roles,permissions,status,jersey) values
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000d0',true,'{captain,manager}','{edit_settings,roster,schedule_games,schedule_events,attendance,scoring,payments,messages,manage_permissions}','active','9');
\echo [ok] and joins the First Team as player + captain + manager in one row
\echo founder appears once on the roster, with both hats (1, {captain,manager}, t):
select count(*), max(roles::text), bool_and(is_player) from roster_members where team_id='20000000-0000-0000-0000-000000000002';
\echo [expect fail] a made-up role:
insert into roster_members(team_id,invited_email,roles) values ('20000000-0000-0000-0000-000000000002','x@x','{goalkeeper_coach}');
\echo [expect fail] not a player and no role:
insert into roster_members(team_id,invited_email,is_player) values ('20000000-0000-0000-0000-000000000002','y@x',false);
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
\echo [expect fail] captain with roster permission makes themself a manager with payments:
update roster_members set roles='{captain,manager}', permissions=permissions||'{payments}' where user_id='00000000-0000-0000-0000-0000000000c0' and team_id='20000000-0000-0000-0000-000000000001';
\echo captain can still invite a plain player (1 row):
insert into roster_members(team_id,invited_email) values ('20000000-0000-0000-0000-000000000001','new@x') returning 1;

\echo == Sponsors
reset role;
update teams set is_public=false where id='20000000-0000-0000-0000-000000000001';
insert into auth.users values ('00000000-0000-0000-0000-0000000000a5'),('00000000-0000-0000-0000-0000000000a6');
insert into profiles(id,first_name,last_name,email) values ('00000000-0000-0000-0000-0000000000a5','Sid','Sponsor','sid@cafe.x'),('00000000-0000-0000-0000-0000000000a6','Out','Sider','out@x');
insert into messages(id,team_id,author_id,subject,body,to_all,to_sponsors) values
 ('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c0','Cup draw','Home to Belleville',true,true),
 ('90000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c0','Subs due','Pay by Friday',true,false);
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
\echo [expect fail] captain without edit_settings adds a sponsor:
insert into sponsors(team_id,name,tier,invited_email) values ('20000000-0000-0000-0000-000000000001','Corner Cafe','gold','sid@cafe.x');
set request.jwt.sub='00000000-0000-0000-0000-0000000000a0';
insert into sponsors(id,team_id,name,tier,contact_user_id,status) values ('a0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Corner Cafe','gold','00000000-0000-0000-0000-0000000000a5','active');
insert into sponsors(id,club_id,name,tier,invited_email) values ('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Limestone Motors','diamond','cars@motors.x');
\echo [ok] club owner adds a gold team sponsor and a diamond club sponsor (invited)
\echo [expect fail] a sponsor tied to both a team and a club:
insert into sponsors(team_id,club_id,name,tier,invited_email) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Both','gold','b@x');
\echo [expect fail] made-up tier:
insert into sponsors(team_id,name,tier,invited_email) values ('20000000-0000-0000-0000-000000000001','Tin Co','tin','t@x');

set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
\echo sponsor reads roster, chat, dues, attendance, events directly (0 0 0 0 0):
select (select count(*) from roster_members), (select count(*) from chat_messages), (select count(*) from dues), (select count(*) from attendance), (select count(*) from events);
\echo sponsor feed: matches only, no trainings (2 match):
select count(*), string_agg(distinct type, ',') from sponsor_feed('20000000-0000-0000-0000-000000000001');
\echo sponsor news: only what was shared (Cup draw):
select subject from sponsor_news('20000000-0000-0000-0000-000000000001');
\echo public sponsor list, top tier first, no emails (Corner Cafe only: the diamond is still invited):
select name, tier from sponsors_public;
\echo sponsor tries to upgrade itself to diamond (0 rows):
update sponsors set tier='diamond' where id='a0000000-0000-0000-0000-000000000001' returning 1;

set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
reset role; update events set sponsor_visible=false where id='30000000-0000-0000-0000-000000000002'; set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
\echo captain hides one match from sponsors (1):
select count(*) from sponsor_feed('20000000-0000-0000-0000-000000000001');
set request.jwt.sub='00000000-0000-0000-0000-0000000000a6';
\echo outsider gets nothing (0, 0):
select (select count(*) from sponsor_feed('20000000-0000-0000-0000-000000000001')), (select count(*) from sponsor_news('20000000-0000-0000-0000-000000000001'));
reset role; update sponsors set ends_on = current_date - 1, starts_on = current_date - 30 where id='a0000000-0000-0000-0000-000000000001'; set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
\echo deal ended yesterday: sponsor view closes (0):
select count(*) from sponsor_feed('20000000-0000-0000-0000-000000000001');

\echo == Sponsor chat
reset role;
update sponsors set ends_on = null, status = 'active' where id='a0000000-0000-0000-0000-000000000001';
insert into conversations(id,team_id,kind) values ('c5000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','sponsors');
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
insert into chat_messages(client_id,conversation_id,author_id,body) values (gen_random_uuid(),'c5000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','Thanks for the shirts!');
\echo [ok] player posts in the sponsors room
set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
insert into chat_messages(client_id,conversation_id,author_id,body) values (gen_random_uuid(),'c5000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a5','Coffee is on us after Saturday');
\echo [ok] sponsor posts in the sponsors room
\echo sponsor reads the sponsors room (2) and the team chat (0):
select (select count(*) from chat_messages where conversation_id='c5000000-0000-0000-0000-000000000001'),
       (select count(*) from chat_messages m join conversations c on c.id = m.conversation_id where c.kind = 'team');
reset role;
select id as team_room from conversations where kind='team' and team_id='20000000-0000-0000-0000-000000000001' \gset
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
\echo [expect fail] sponsor posts in the team chat:
insert into chat_messages(client_id,conversation_id,author_id,body) values (gen_random_uuid(),:'team_room','00000000-0000-0000-0000-0000000000a5','hi');
\echo sponsor sees the player as "Rahul O.", itself in full with its business:
select display_name, sponsor_name, sponsor_tier from chat_people('c5000000-0000-0000-0000-000000000001') order by display_name;
\echo sponsor reads player profiles directly (0):
select count(*) from profiles where id='00000000-0000-0000-0000-0000000000b1';
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo player sees full names and the sponsor badge:
select display_name, sponsor_name, sponsor_tier from chat_people('c5000000-0000-0000-0000-000000000001') order by display_name;
set request.jwt.sub='00000000-0000-0000-0000-0000000000a6';
\echo outsider reads the room (0):
select count(*) from chat_messages where conversation_id='c5000000-0000-0000-0000-000000000001';
\echo [expect fail] outsider posts:
insert into chat_messages(client_id,conversation_id,author_id,body) values (gen_random_uuid(),'c5000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a6','buy my stuff');
reset role; update teams set sponsor_chat=false where id='20000000-0000-0000-0000-000000000001'; set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000a5';
\echo captain switches sponsor chat off: sponsor reads (0):
select count(*) from chat_messages where conversation_id='c5000000-0000-0000-0000-000000000001';
reset role; update teams set sponsor_chat=true where id='20000000-0000-0000-0000-000000000001'; update sponsors set status='ended' where id='a0000000-0000-0000-0000-000000000001'; set role authenticated;
\echo deal ended: sponsor reads (0):
select count(*) from chat_messages where conversation_id='c5000000-0000-0000-0000-000000000001';

\echo == Invite link
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000d2');
insert into profiles(id,first_name,last_name,email) values ('00000000-0000-0000-0000-0000000000d1','Leo','Link','leo@x'),('00000000-0000-0000-0000-0000000000d2','Ana','Ask','ana@x');
\echo existing team got a link (1):
select count(*) from team_invite_links where team_id='20000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
select token as link from team_invite_links where team_id='20000000-0000-0000-0000-000000000001' \gset
\echo captain reads the link: 22 chars:
select length(:'link');
set request.jwt.sub='00000000-0000-0000-0000-0000000000b1';
\echo player reads the link (0):
select count(*) from team_invite_links;
\echo [expect fail] player resets the link:
select reset_invite_link('20000000-0000-0000-0000-000000000001');
reset role; set role anon; set request.jwt.sub='';
\echo signed-out join page: Reserves, Limestone City FC, signed-out, no roster:
select name, club_name, me, needs_approval from join_page(:'link');
\echo made-up link (0):
select count(*) from join_page('xxxxxxxxxxxxxxxxxxxxxx');
\echo [expect fail] anon joins:
select * from join_by_link(:'link');
reset role; set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000d1';
\echo Leo joins (joined), again (member):
select status from join_by_link(:'link');
select status from join_by_link(:'link');
\echo Leo is a player with no roles or permissions:
select is_player, roles, permissions, status from roster_members where user_id='00000000-0000-0000-0000-0000000000d1';
reset role;
\echo captain got an email about it (1):
select count(*) from outbox where kind='joined_by_link' and user_id='00000000-0000-0000-0000-0000000000c0';
set role authenticated;
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
update team_invite_links set needs_approval = true where team_id='20000000-0000-0000-0000-000000000001';
\echo [ok] captain turns approval on
set request.jwt.sub='00000000-0000-0000-0000-0000000000d2';
\echo Ana asks (requested), join page says requested, not on the team yet (0):
select status from join_by_link(:'link');
select me from join_page(:'link');
select count(*) from roster_members where user_id='00000000-0000-0000-0000-0000000000d2';
select id as req from join_requests where user_id='00000000-0000-0000-0000-0000000000d2' \gset
\echo [expect fail] Ana approves herself:
select decide_join_request(:'req', true);
\echo [expect fail] Ana inserts herself into the roster:
insert into roster_members(team_id,user_id,status) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d2','active');
set request.jwt.sub='00000000-0000-0000-0000-0000000000c0';
select decide_join_request(:'req', true);
\echo [ok] captain lets Ana in
\echo Ana on the roster (1):
select count(*) from roster_members where user_id='00000000-0000-0000-0000-0000000000d2' and status='active';
\echo captain resets: old link dead (0), new one works (1):
select reset_invite_link('20000000-0000-0000-0000-000000000001') as newlink \gset
select count(*) from join_page(:'link');
select count(*) from join_page(:'newlink');
set request.jwt.sub='00000000-0000-0000-0000-0000000000a6';
\echo [expect fail] outsider uses the old link:
select * from join_by_link(:'link');
