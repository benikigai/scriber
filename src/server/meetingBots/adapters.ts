import type { MeetingPlatform } from "./types";

export type AdapterReadiness = {
  platform: MeetingPlatform;
  ready: boolean;
  runtime: "google-meet-playwright" | "zoom-meeting-sdk";
  missing: string[];
  capabilities: string[];
};

function missingEnv(vars: [string, string | undefined][]) {
  return vars.reduce<string[]>((missing, [name, value]) => {
    if (!value) missing.push(name);
    return missing;
  }, []);
}

export function adapterReadiness(platform: MeetingPlatform): AdapterReadiness {
  if (platform === "google_meet") {
    const missing = missingEnv([
      ["SCRIBER_CHROME_EXECUTABLE_PATH", process.env.SCRIBER_CHROME_EXECUTABLE_PATH],
      ["SCRIBER_GOOGLE_PROFILE_DIR", process.env.SCRIBER_GOOGLE_PROFILE_DIR],
      ["SCRIBER_BRIDGE_URL", process.env.SCRIBER_BRIDGE_URL],
    ]);
    return {
      platform,
      ready: missing.length === 0,
      runtime: "google-meet-playwright",
      missing,
      capabilities: [
        "join",
        "mixed_audio_capture",
        "virtual_microphone_output",
        "status_tile",
        "chat_events",
        "caption_events",
        "screen_share_screenshots",
      ],
    };
  }

  const missing = missingEnv([
    ["ZOOM_MEETING_SDK_KEY", process.env.ZOOM_MEETING_SDK_KEY],
    ["ZOOM_MEETING_SDK_SECRET", process.env.ZOOM_MEETING_SDK_SECRET],
    ["SCRIBER_BRIDGE_URL", process.env.SCRIBER_BRIDGE_URL],
  ]);
  return {
    platform,
    ready: missing.length === 0,
    runtime: "zoom-meeting-sdk",
    missing,
    capabilities: [
      "join",
      "mixed_audio_capture",
      "per_participant_audio_capture",
      "raw_data_permission",
      "bot_microphone_output",
      "screen_share_frames",
      "chat_events",
    ],
  };
}

export function allAdapterReadiness() {
  return [adapterReadiness("google_meet"), adapterReadiness("zoom")];
}
