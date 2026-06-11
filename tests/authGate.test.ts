import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirectPath } from "../src/lib/authGate";

test("hosted runtime normalizes legacy console redirects to meetings", () => {
  const previousDomain = process.env.SCRIBER_DOMAIN;
  const previousAllowConsole = process.env.SCRIBER_ALLOW_CONSOLE_REDIRECTS;
  process.env.SCRIBER_DOMAIN = "app.usescriber.com";
  delete process.env.SCRIBER_ALLOW_CONSOLE_REDIRECTS;

  try {
    assert.equal(safeRedirectPath("/console?agentConfig=scriber"), "/meetings");
    assert.equal(safeRedirectPath("/console"), "/meetings");
  } finally {
    if (previousDomain === undefined) {
      delete process.env.SCRIBER_DOMAIN;
    } else {
      process.env.SCRIBER_DOMAIN = previousDomain;
    }

    if (previousAllowConsole === undefined) {
      delete process.env.SCRIBER_ALLOW_CONSOLE_REDIRECTS;
    } else {
      process.env.SCRIBER_ALLOW_CONSOLE_REDIRECTS = previousAllowConsole;
    }
  }
});

test("local demo can still redirect to the browser console", () => {
  const previousDomain = process.env.SCRIBER_DOMAIN;
  delete process.env.SCRIBER_DOMAIN;

  try {
    assert.equal(safeRedirectPath("/console?agentConfig=scriber"), "/console?agentConfig=scriber");
  } finally {
    if (previousDomain !== undefined) process.env.SCRIBER_DOMAIN = previousDomain;
  }
});
