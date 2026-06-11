import assert from "node:assert/strict";
import test from "node:test";
import {
  createMeetingBot,
  getToolProposal,
  resetMeetingBotStoreForTests,
} from "../src/server/meetingBots/store";
import { executeScriberTool, rejectToolProposal } from "../src/server/tools/scriberToolExecutor";

test("write tools create pending proposals", async () => {
  resetMeetingBotStoreForTests();
  const bot = createMeetingBot({
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    title: "Standup",
  });

  const result = await executeScriberTool({
    toolName: "linear_create_issue",
    arguments: { title: "Follow up on OAuth" },
    meetingBotId: bot.id,
    source: "meeting",
  });

  assert.ok("requires_approval" in result);
  assert.equal(result.requires_approval, true);
  assert.ok("proposal_id" in result);
  const proposal = getToolProposal(String(result.proposal_id));
  assert.ok(proposal);
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.meetingBotId, bot.id);

  const rejected = rejectToolProposal(proposal.id);
  assert.equal(rejected.status, "rejected");
});
