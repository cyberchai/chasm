import type { ChasmBuilderCommand } from "../agentphone/types.js";
import type { EnvSource } from "../env.js";
import { logger, type ChasmLogger } from "../logger.js";
import {
  inferProjectId,
  previewUrlForProject,
  type ChasmBuilderResult,
} from "./builderCommands.js";

export type ProcessBuilderCommandOptions = {
  env?: EnvSource;
  logger?: ChasmLogger;
};

export async function processBuilderCommand(
  command: ChasmBuilderCommand,
  { env = process.env, logger: log = logger }: ProcessBuilderCommandOptions = {},
): Promise<ChasmBuilderResult> {
  const projectId = inferProjectId(command);
  const previewUrl = previewUrlForProject(projectId, env);

  log.info("Chasm builder command received", {
    channel: command.channel,
    eventId: command.eventId,
    mediaCount: command.mediaUrls.length,
    projectId,
    sessionId: command.sessionId,
    text: truncate(command.text),
  });

  // TODO: update canonical site_spec.json.
  // TODO: generate a code patch through codegen.applyEdit().
  // TODO: run build/typecheck before accepting the patch.
  // TODO: hot-update the live Vite preview.
  // TODO: notify the user with the final codegen summary.

  return {
    status: "completed",
    summary: "Stub builder accepted the change and is ready for the real codegen pipeline.",
    previewUrl,
    projectId,
  };
}

function truncate(value: string, maxLength = 160): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
