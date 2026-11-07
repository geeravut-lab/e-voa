// The language the rest of the app speaks to AI: neutral turns in, a neutral answer out. Each provider's own format stays inside its adapter.
export const PROVIDER_IDS = ["anthropic", "google"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
/** What the service uses AI for. "chat" is the help assistant; "prompt_review" checks an administrator's added instructions (it can never be edited). */
export const TASK_KINDS = ["chat", "prompt_review"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown>; strict?: boolean };
export type ToolCall = { id: string; name: string; input: unknown };
export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; calls: ToolCall[]; raw?: { provider: ProviderId; value: unknown } }          // raw: the provider's own copy, replayed as it is when the same provider continues
  | { role: "tool"; results: { id: string; name: string; content: string }[] };

export type AiRequest = { system: string; turns: Turn[]; tools?: ToolDef[]; maxTokens: number; json?: boolean };
export type AiResponse = { text: string; calls: ToolCall[]; raw: { provider: ProviderId; value: unknown }; stop: "end" | "tools" | "refusal" | "length"; provider: ProviderId; model: string; usage: { inputTokens: number; outputTokens: number } };

export type AiErrorCode = "not_configured" | "provider_failed" | "bad_output" | "unsupported" | "free_tier";
export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public status?: number) { super(message); }
}
export interface ProviderAdapter {
  id: ProviderId;
  call(req: AiRequest, model: string, apiKey: string, task: TaskKind): Promise<AiResponse>;
  listModels(apiKey: string): Promise<string[]>;
}
