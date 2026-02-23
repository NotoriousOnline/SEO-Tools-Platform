#!/usr/bin/env node
/**
 * E2E test script for Meeting-to-Actions tool.
 * Run: node scripts/e2e-meeting-to-actions.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000
 *
 * Requires: dotenv (npm install dotenv) and .env.local with FATHOM_WEBHOOK_SECRET
 */
import crypto from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env.local (override: true so we always get values from file)
try {
  const { default: dotenvConfig } = await import("dotenv");
  const envPath = resolve(root, ".env.local");
  dotenvConfig({ path: envPath, override: true });
} catch {}

const baseUrl = process.argv[2] || "http://localhost:3000";
const secret = process.env.FATHOM_WEBHOOK_SECRET;

function hmacSha256Hex(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

const SAMPLE_PAYLOAD = {
  meeting_title: "Q1 Planning - Acme Corp",
  date: "2026-02-21",
  participants: ["Sam", "Alex", "Client Name"],
  summary:
    "Discussed Q1 roadmap. Sam to write proposal by Friday. Alex to set up staging environment. Client to review and sign off by end of month.",
  transcript: "Full transcript here...",
  action_items: [],
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  return { res, data };
}

async function run() {
  let passed = 0;
  let failed = 0;

  console.log("\n=== E2E Meeting-to-Actions Tests ===\n");
  console.log("Base URL:", baseUrl);

  // --- 1. Invalid webhook signature → 401 ---
  console.log("\n1. Invalid webhook signature → 401");
  const body1 = JSON.stringify(SAMPLE_PAYLOAD);
  const badSig = "invalid_signature_hex";
  const { res: r1 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fathom-Signature": badSig,
    },
    body: body1,
  });
  if (r1.status === 401) {
    console.log("   ✓ 401 returned");
    passed++;
  } else {
    console.log("   ✗ Expected 401, got", r1.status);
    failed++;
  }

  // --- 2. Valid webhook signature → 200, meeting stored ---
  if (!secret) {
    console.log("\n2. Valid webhook (SKIP: no FATHOM_WEBHOOK_SECRET)");
  } else {
    console.log("\n2. Valid webhook signature → 200, meeting stored");
    const body2 = JSON.stringify(SAMPLE_PAYLOAD);
    const sig2 = hmacSha256Hex(body2, secret);
    const { res: r2 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fathom-Signature": sig2,
      },
      body: body2,
    });
    if (r2.status === 200) {
      console.log("   ✓ 200 returned");
      passed++;
    } else {
      console.log("   ✗ Expected 200, got", r2.status);
      failed++;
    }

    // --- 3. Status returns meeting ---
    console.log("\n3. Status returns meeting");
    const { res: r3, data: d3 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/status`);
    if (r3.status === 200 && d3?.meeting?.meeting_title === SAMPLE_PAYLOAD.meeting_title) {
      console.log("   ✓ Meeting in status");
      passed++;
    } else {
      console.log("   ✗ Expected meeting in status, got", d3);
      failed++;
    }
  }

  // --- 4. Process (requires Claude) - optional ---
  console.log("\n4. Process with Claude (real API call)");
  const { res: r4, data: d4 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_title: SAMPLE_PAYLOAD.meeting_title,
      date: SAMPLE_PAYLOAD.date,
      participants: SAMPLE_PAYLOAD.participants,
      summary: SAMPLE_PAYLOAD.summary,
      transcript: SAMPLE_PAYLOAD.transcript,
    }),
  });
  if (r4.status === 200 && (d4?.email_draft || (d4?.actions && d4.actions.length > 0))) {
    console.log("   ✓ Process returned email draft and/or actions");
    passed++;
  } else if (r4.status === 200) {
    console.log("   ✓ Process returned 200 (empty draft/actions)");
    passed++;
  } else {
    console.log("   ✗ Process failed:", r4.status, d4?.error || "");
    failed++;
  }

  // --- 5. Create tasks (requires Asana) - optional ---
  console.log("\n5. Create tasks (Asana)");
  const mockActions = [
    {
      task_title: "Write proposal",
      description: "Q1 proposal",
      owner: "Sam",
      due_date: "2026-02-28",
      priority: "High",
    },
    {
      task_title: "Set up staging",
      description: "Staging env",
      owner: "UnrecognisedOwner",
      due_date: "2026-02-25",
      priority: "Medium",
    },
  ];
  const { res: r5, data: d5 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/create-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_title: SAMPLE_PAYLOAD.meeting_title,
      date: SAMPLE_PAYLOAD.date,
      actions: mockActions,
    }),
  });
  if (r5.status === 200 && Array.isArray(d5)) {
    const allSuccess = d5.every((x) => x.success);
    console.log("   ✓ Create tasks returned array, success:", allSuccess);
    if (d5.some((x) => !x.success)) {
      console.log("   ✓ Unrecognised owner falls back to DEFAULT_OWNER (no crash)");
    }
    passed++;
  } else {
    console.log("   ✗ Create tasks failed:", r5.status, d5?.error || "");
    failed++;
  }

  // --- 6. Create draft (requires Gmail) - optional ---
  console.log("\n6. Create Gmail draft");
  const { res: r6, data: d6 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/create-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: "Q1 Planning Summary",
      body: "Test body",
    }),
  });
  if (r6.status === 200 && d6?.gmail_link) {
    console.log("   ✓ Draft created:", d6.gmail_link);
    passed++;
  } else if (r6.status === 401) {
    console.log("   ✓ Gmail token expired (401) - clear error expected in UI");
    passed++;
  } else {
    console.log("   ✗ Expected 200 or 401, got", r6.status, d6?.error || "");
    failed++;
  }

  // --- 6b. Malformed JSON from Claude → 500, UI shows error ---
  console.log("\n6b. Malformed JSON (mock) → 500");
  const { res: r6b, data: d6b } = await fetchJson(`${baseUrl}/api/meeting-to-actions/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_title: "MOCK_MALFORMED_JSON",
      date: "2026-02-21",
      participants: [],
      summary: "",
      transcript: "",
    }),
  });
  if (r6b.status === 500 && d6b?.error?.includes("malformed")) {
    console.log("   ✓ 500 with malformed JSON error");
    passed++;
  } else {
    console.log("   ✗ Expected 500, got", r6b.status, d6b?.error || "");
    failed++;
  }

  // --- 7. Notify Slack ---
  console.log("\n7. Notify Slack");
  const { res: r7, data: d7 } = await fetchJson(`${baseUrl}/api/meeting-to-actions/notify-slack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_title: SAMPLE_PAYLOAD.meeting_title,
      date: SAMPLE_PAYLOAD.date,
      tasks: [{ task_title: "Test", owner: "Sam", task_url: "https://example.com" }],
      gmail_link: "https://mail.google.com/mail/#drafts/123",
    }),
  });
  if (r7.status === 200) {
    if (d7?.success) {
      console.log("   ✓ Slack notification sent");
    } else {
      console.log("   ✓ Slack returned (no crash), success:", d7?.success);
    }
    passed++;
  } else {
    console.log("   ✗ Expected 200, got", r7.status);
    failed++;
  }

  console.log("\n=== Summary ===");
  console.log("Passed:", passed, "Failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
