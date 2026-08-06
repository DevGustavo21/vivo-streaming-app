import assert from "node:assert/strict";
import { formatInviteCode, getInviteUrl, normalizeInviteCode, resolveInviteCodeParam } from "./invite";

const sample = "abcdefghij";

assert.equal(formatInviteCode(sample), "abc-defg-hij");
assert.equal(normalizeInviteCode("abc-defg-hij"), sample);
assert.equal(normalizeInviteCode("ABC-DEFG-HIJ"), sample);
assert.equal(normalizeInviteCode("https://app.example/join/abc-defg-hij"), sample);
assert.equal(normalizeInviteCode("https://app.example/room/abc-defg-hij"), sample);
assert.equal(normalizeInviteCode("  abc-defg-hij  "), sample);
assert.equal(resolveInviteCodeParam("abc-defg-hij"), sample);
assert.equal(getInviteUrl(sample, "https://app.example"), `https://app.example/join/${sample}`);

console.log("invite.ts: all assertions passed");
