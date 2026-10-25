// node --experimental-strip-types --no-warnings src/lib/geo/parse-location.test.ts
import assert from "node:assert/strict";
import { isShortMapLink, parseLocation } from "./parse-location.ts";

const near = (a: { lat: number; lng: number } | null, lat: number, lng: number) => {
  assert.ok(a, "no match");
  assert.ok(Math.abs(a.lat - lat) < 1e-6 && Math.abs(a.lng - lng) < 1e-6, JSON.stringify(a));
};
near(parseLocation("44.2312, -76.486"), 44.2312, -76.486);
near(parseLocation("44.2312 -76.486"), 44.2312, -76.486);
near(parseLocation("https://www.google.com/maps/@44.2300,-76.4800,17z"), 44.23, -76.48);
near(parseLocation("https://www.google.com/maps/place/Caraco+Park/@44.2300,-76.4800,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d44.2312!4d-76.4861"), 44.2312, -76.4861);
near(parseLocation("https://maps.google.com/?q=44.2312,-76.4861"), 44.2312, -76.4861);
near(parseLocation("https://www.google.com/maps/search/?api=1&query=44.2312%2C-76.4861"), 44.2312, -76.4861);
near(parseLocation("https://maps.apple.com/?ll=44.2312,-76.4861&q=Pitch"), 44.2312, -76.4861);
near(parseLocation("https://www.openstreetmap.org/#map=17/44.2312/-76.4861"), 44.2312, -76.4861);
assert.equal(parseLocation("Caraco Park"), null);
assert.equal(parseLocation("200, 300"), null);
assert.equal(parseLocation("0,0"), null);
assert.ok(isShortMapLink("https://maps.app.goo.gl/AbCdEf123"));
assert.ok(!isShortMapLink("https://evil.example/maps.app.goo.gl"));
assert.ok(!isShortMapLink("http://maps.app.goo.gl/x"));
console.log("parse-location: all checks pass");
