import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const site = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/site.js"),
  "utf8"
);
const start = site.indexOf("function stripeClientReference");
const end = site.indexOf("\n(function ()");
if (start < 0 || end < start) {
  console.error("stripeClientReference was not found in public/site.js");
  process.exit(1);
}
const sandbox = {};
vm.runInNewContext(site.slice(start, end), sandbox);
const id = sandbox.stripeClientReference;

const cases = [
  ["abc", "user_1", "ref-abc_u-user_1"],
  ["ab=c;d", "", "ref-ab_c_d"],
  ["", "x y", "u-x_y"],
  ["", "", ""],
  ["!!!", "ok", "ref-____u-ok"],
];

let failed = 0;
for (const [ref, user, expected] of cases) {
  const got = id(ref, user);
  const ok = got === expected && (got === "" || /^[A-Za-z0-9_-]{1,200}$/.test(got));
  if (!ok) {
    failed += 1;
    console.error("expected", JSON.stringify(expected), "got", JSON.stringify(got));
  }
}
const cleanStart = site.indexOf("function clean");
const cleanEnd = site.indexOf("function setHref");
vm.runInNewContext("var MAX_LEN = 96;\n" + site.slice(cleanStart, cleanEnd) + "\nthis.clean = clean;", sandbox);
if (sandbox.clean("ab=c;d user") !== "abcduser") {
  failed += 1;
  console.error("clean failed", sandbox.clean("ab=c;d user"));
}
if (sandbox.clean("ok_Name-1") !== "ok_Name-1") {
  failed += 1;
  console.error("clean kept too little", sandbox.clean("ok_Name-1"));
}
const long = id("a".repeat(180), "b".repeat(180));
if (long.length !== 200 || !/^[A-Za-z0-9_-]+$/.test(long) || !long.startsWith("ref-")) {
  failed += 1;
  console.error("cap failed", long.length, long.slice(0, 20));
}
if (failed) process.exit(1);
console.log("stripe client_reference_id checks passed");
