import {
  attachNumberToAgent,
  createOrUpdateAgentWebhook,
  createOrUpdateChasmAgent,
  createOrUpdateProjectWebhook,
  provisionOrUseNumber,
} from "../orchestrator/src/server/agentphone/client.js";
import { appendPath, getEnv, requireEnv } from "../orchestrator/src/server/env.js";

const DEFAULT_AGENT_NAME = "Chasm";
const DEFAULT_DESCRIPTION =
  "Chasm is an on-the-fly AI website builder controlled by text, iMessage, SMS, MMS, and voice calls.";
const DEFAULT_BEGIN_MESSAGE =
  "Hey, this is Chasm. Tell me what you want to build or change on your site.";

type Flags = {
  agentName: string;
  areaCode?: string;
  dryRun: boolean;
  help: boolean;
  webhookUrl?: string;
};

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.help) {
    printUsage();
    return;
  }

  requireEnv("AGENTPHONE_API_KEY");

  const webhookUrl = resolveWebhookUrl(flags);

  if (!webhookUrl) {
    throw new Error(
      "Provide --webhook-url, AGENTPHONE_WEBHOOK_URL, or CHASM_PUBLIC_APP_URL before running setup.",
    );
  }

  const agentIdFromEnv = getEnv("AGENTPHONE_AGENT_ID");
  const numberIdFromEnv = getEnv("AGENTPHONE_NUMBER_ID");
  const areaCode = flags.areaCode ?? getEnv("AGENTPHONE_AREA_CODE");

  if (flags.dryRun) {
    console.log("Dry run: no AgentPhone resources will be created or updated.");
    console.log("Agent payload:", {
      beginMessage: DEFAULT_BEGIN_MESSAGE,
      description: DEFAULT_DESCRIPTION,
      name: flags.agentName,
      voiceMode: "webhook",
    });
    console.log("Number:", numberIdFromEnv ? { reuse: numberIdFromEnv } : { areaCode, country: "US" });
    console.log("Webhook:", { contextLimit: 10, timeout: 60, url: webhookUrl });
    return;
  }

  const agent = await createOrUpdateChasmAgent({
    agentId: agentIdFromEnv,
    agentName: flags.agentName,
    beginMessage: DEFAULT_BEGIN_MESSAGE,
    description: DEFAULT_DESCRIPTION,
  });

  const number = await provisionOrUseNumber({
    agentId: agent.id,
    areaCode,
    numberId: numberIdFromEnv,
  });

  await attachNumberToAgent({
    agentId: agent.id,
    numberId: number.id,
  });

  let webhookSecret: string | undefined;

  try {
    const webhook = await createOrUpdateAgentWebhook({
      agentId: agent.id,
      contextLimit: 10,
      timeout: 60,
      url: webhookUrl,
    });
    webhookSecret = webhook.secret;
    console.log("Configured AgentPhone per-agent webhook.");
  } catch (error) {
    console.warn("Per-agent webhook setup failed; falling back to the project webhook.", error);
    const webhook = await createOrUpdateProjectWebhook({
      contextLimit: 10,
      timeout: 60,
      url: webhookUrl,
    });
    webhookSecret = webhook.secret;
    console.log("Configured AgentPhone project webhook.");
  }

  console.log("\nAdd or update these values in .env:");
  console.log(`AGENTPHONE_AGENT_ID=${agent.id}`);
  console.log(`AGENTPHONE_NUMBER_ID=${number.id}`);
  console.log(`AGENTPHONE_WEBHOOK_SECRET=${webhookSecret ?? ""}`);
  console.log(`AGENTPHONE_WEBHOOK_URL=${webhookUrl}`);

  if (number.phoneNumber) {
    console.log(`\nProvisioned phone number: ${number.phoneNumber}`);
  }
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {
    agentName: DEFAULT_AGENT_NAME,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--webhook-url" && next) {
      flags.webhookUrl = next;
      index += 1;
    } else if (arg === "--area-code" && next) {
      flags.areaCode = next;
      index += 1;
    } else if (arg === "--agent-name" && next) {
      flags.agentName = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete flag: ${arg}`);
    }
  }

  return flags;
}

function resolveWebhookUrl(flags: Flags): string | undefined {
  if (flags.webhookUrl) {
    return flags.webhookUrl;
  }

  const configuredWebhookUrl = getEnv("AGENTPHONE_WEBHOOK_URL");

  if (configuredWebhookUrl) {
    return configuredWebhookUrl;
  }

  const publicAppUrl = getEnv("CHASM_PUBLIC_APP_URL");
  return publicAppUrl ? appendPath(publicAppUrl, "/api/agentphone/webhook") : undefined;
}

function printUsage(): void {
  console.log(`Usage: npm run chasm:agentphone:setup -- [options]

Options:
  --webhook-url <url>   Public HTTPS webhook URL, e.g. https://demo.ngrok.app/api/agentphone/webhook
  --area-code <code>    Preferred US/CA area code for provisioning
  --agent-name <name>   Agent name (default: Chasm)
  --dry-run             Print planned changes without calling AgentPhone
  --help                Show this help text`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
