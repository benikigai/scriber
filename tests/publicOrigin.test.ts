import assert from "node:assert/strict";
import test from "node:test";
import { publicAppOrigin, publicAppUrl } from "../src/lib/publicOrigin";

function requestLike(input: {
  headers?: Record<string, string>;
  nextUrl?: { protocol: string; host: string };
}) {
  const headers = new Headers(input.headers);
  return {
    headers,
    nextUrl: input.nextUrl ?? { protocol: "http:", host: "localhost:3000" },
  };
}

test("configured Scriber domain wins over internal proxy origin", () => {
  const previousDomain = process.env.SCRIBER_DOMAIN;
  process.env.SCRIBER_DOMAIN = "app.usescriber.com";

  try {
    const req = requestLike({
      headers: { host: "localhost:3000" },
      nextUrl: { protocol: "https:", host: "localhost:3000" },
    });

    assert.equal(publicAppOrigin(req), "https://app.usescriber.com");
    assert.equal(publicAppUrl("/meetings", req).toString(), "https://app.usescriber.com/meetings");
  } finally {
    if (previousDomain === undefined) {
      delete process.env.SCRIBER_DOMAIN;
    } else {
      process.env.SCRIBER_DOMAIN = previousDomain;
    }
  }
});

test("public origin falls back to forwarded headers without configured domain", () => {
  const previousDomain = process.env.SCRIBER_DOMAIN;
  delete process.env.SCRIBER_DOMAIN;

  try {
    const req = requestLike({
      headers: {
        "x-forwarded-host": "preview.usescriber.com",
        "x-forwarded-proto": "https",
      },
    });

    assert.equal(publicAppOrigin(req), "https://preview.usescriber.com");
  } finally {
    if (previousDomain !== undefined) process.env.SCRIBER_DOMAIN = previousDomain;
  }
});
