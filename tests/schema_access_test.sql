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
insert into roster_members(team_id,user_id,role,permissions,status) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c0','captain','{attendance,schedule_events,scoring}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','player','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','player','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b3','player','{}','active'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e0','player','{}','active');
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
