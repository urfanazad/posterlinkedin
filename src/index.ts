import fetch from "node-fetch";
import "dotenv/config";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

type QueueItem = {
  id: string;
  text: string;
  whenIso: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  approved: boolean;
  status: "QUEUED" | "PUBLISHED" | "FAILED";
  lastError?: string;
  publishedAtIso?: string;
};

const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
const AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN || ""; // e.g. urn:li:person:xxxx
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || "202502"; // YYYYMM

if (!LINKEDIN_TOKEN) {
  console.error("Missing env LINKEDIN_ACCESS_TOKEN");
}
if (!AUTHOR_URN) {
  console.error("Missing env LINKEDIN_AUTHOR_URN (urn:li:person:...)");
}

const queue: QueueItem[] = [];

function newId() {
  return `post_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

async function publishToLinkedIn(text: string, visibility: "PUBLIC" | "CONNECTIONS") {
  // LinkedIn Posts API (replaces ugcPosts) :contentReference[oaicite:1]{index=1}
  const url = "https://api.linkedin.com/rest/posts";

  // Minimal payload for a member-authored text post.
  // Note: Payload shapes can vary by API version/products enabled.
  const body = {
    author: AUTHOR_URN,
    commentary: text,
    visibility,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  });

  const textResp = await res.text();
  if (!res.ok) {
    throw new Error(`LinkedIn error ${res.status}: ${textResp}`);
  }
  return textResp;
}

const QueuePostInput = z.object({
  text: z.string().min(1).max(3000),
  whenIso: z.string().min(1), // ISO datetime string
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
});

const ApproveInput = z.object({ id: z.string().min(1) });
const PublishInput = z.object({ id: z.string().min(1) });

const server = new Server(
  { name: "mcp-linkedin-poster", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "health",
        description: "Check server status and required env vars.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "queue_post",
        description: "Queue a LinkedIn post for later publishing.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            whenIso: { type: "string" },
            visibility: { type: "string", enum: ["PUBLIC", "CONNECTIONS"] },
          },
          required: ["text", "whenIso"],
        },
      },
      {
        name: "list_queue",
        description: "List queued posts.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "approve_post",
        description: "Approve a queued post (simple human-in-the-loop gate).",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "publish_post",
        description: "Publish an approved post now via LinkedIn Posts API.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = req.params.name;
  const args = req.params.arguments ?? {};

  if (tool === "health") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              hasToken: Boolean(LINKEDIN_TOKEN),
              hasAuthorUrn: Boolean(AUTHOR_URN),
              linkedinVersion: LINKEDIN_VERSION,
              queued: queue.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (tool === "queue_post") {
    const input = QueuePostInput.parse(args);
    const item: QueueItem = {
      id: newId(),
      text: input.text,
      whenIso: input.whenIso,
      visibility: input.visibility,
      approved: false,
      status: "QUEUED",
    };
    queue.push(item);
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  }

  if (tool === "list_queue") {
    return { content: [{ type: "text", text: JSON.stringify(queue, null, 2) }] };
  }

  if (tool === "approve_post") {
    const input = ApproveInput.parse(args);
    const item = queue.find((x) => x.id === input.id);
    if (!item) throw new Error("Not found");
    item.approved = true;
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  }

  if (tool === "publish_post") {
    const input = PublishInput.parse(args);
    const item = queue.find((x) => x.id === input.id);
    if (!item) throw new Error("Not found");
    if (!item.approved) throw new Error("Post is not approved");

    try {
      const resp = await publishToLinkedIn(item.text, item.visibility);
      item.status = "PUBLISHED";
      item.publishedAtIso = new Date().toISOString();
      return {
        content: [
          { type: "text", text: JSON.stringify({ item, apiResponse: resp }, null, 2) },
        ],
      };
    } catch (e: any) {
      item.status = "FAILED";
      item.lastError = String(e?.message || e);
      return {
        content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
      };
    }
  }

  throw new Error(`Unknown tool: ${tool}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
