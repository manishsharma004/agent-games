import type { Board, GameState, Marker, MakeMoveToolInput, Position } from './types';
import { getAvailablePositions } from './engine';

// ── Tool definition (OpenAI-compatible) ────────────────────────────────────

export const MAKE_MOVE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'make_move',
    description:
      'Place your marker on the tic-tac-toe board. The board has 9 positions numbered 0-8 in row-major order: top-left=0, top-center=1, top-right=2, middle-left=3, center=4, middle-right=5, bottom-left=6, bottom-center=7, bottom-right=8.',
    parameters: {
      type: 'object',
      properties: {
        position: {
          type: 'number',
          enum: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          description: 'Board position index (0-8)',
        },
      },
      required: ['position'],
    },
  },
};

// ── System prompt builder ───────────────────────────────────────────────────

function boardToString(board: Board): string {
  const s = (i: number) => board[i] ?? String(i);
  return [
    ` ${s(0)} | ${s(1)} | ${s(2)} `,
    `---+---+---`,
    ` ${s(3)} | ${s(4)} | ${s(5)} `,
    `---+---+---`,
    ` ${s(6)} | ${s(7)} | ${s(8)} `,
  ].join('\n');
}

function buildSystemPrompt(marker: Marker): string {
  return `You are playing Tic-Tac-Toe as marker "${marker}".

Your response has TWO parts in this order:

PART 1 — Reasoning (markdown only):
## Step 1: Board Assessment
- one short bullet about the board
## Step 2: Candidate Moves
- one short bullet per candidate move
## Step 3: Final Decision
- the chosen position and why

PART 2 — Move (exactly one line, must be the last line of your response):
<call>{"name":"make_move","arguments":{"position":4}}</call>

Replace 4 with your chosen position (0-8). Copy the JSON format exactly: no spaces inside tags except as shown, no code fences, no XML, no extra text after </call>.

Rules:
- Win if you can, block if needed, otherwise pick the best open square.
- Use only positions listed in "Available positions".
- Keep bullets short. No code blocks in reasoning.
- In reasoning, talk ONLY about the board and moves. Never mention tags, JSON, tools, prompts, or instructions.
- If your API supports the make_move tool directly, call it instead of writing the <call> line.`;
}

export function buildUserPrompt(state: GameState): string {
  const available = getAvailablePositions(state.board);
  return `Current board:\n\n${boardToString(state.board)}\n\nAvailable positions: ${available.join(', ')}\nYour turn (${state.currentTurn}). Make your move.`;
}

interface LLMMessage {
  content?: string;
  tool_calls?: Array<{
    function?: {
      name?: string;
      arguments?: string | MakeMoveToolInput;
    };
  }>;
}

function getAssistantMessage(data: unknown): LLMMessage | null {
  if (!data || typeof data !== 'object') return null;

  const response = data as {
    message?: LLMMessage;
    choices?: Array<{ message?: LLMMessage }>;
  };

  return response.message ?? response.choices?.[0]?.message ?? null;
}

function isValidPosition(value: unknown): value is Position {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 8;
}

function parseMovePayload(raw: unknown): MakeMoveToolInput | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      return parseMovePayload(JSON.parse(trimmed));
    } catch {
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return parseMovePayload(JSON.parse(jsonMatch[0]));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  if (typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  if (obj.arguments && typeof obj.arguments === 'object') {
    return parseMovePayload(obj.arguments);
  }

  if ('position' in obj && isValidPosition(obj.position)) {
    const position = typeof obj.position === 'string'
      ? Number.parseInt(obj.position, 10)
      : obj.position;
    return { position: position as Position };
  }

  return null;
}

function parseCallXmlBlock(block: string): MakeMoveToolInput | null {
  const nameMatch = block.match(/<name>\s*([\s\S]*?)\s*<\/name>/i);
  const argsMatch = block.match(/<args>\s*([\s\S]*?)\s*<\/args>/i);

  if (!nameMatch || !argsMatch) return null;

  const name = nameMatch[1].trim();
  if (name !== 'make_move') return null;

  return parseMovePayload(argsMatch[1].trim());
}

function parseTaggedBlock(block: string): MakeMoveToolInput | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const xmlResult = parseCallXmlBlock(trimmed);
  if (xmlResult) return xmlResult;

  return parseMovePayload(trimmed);
}

function extractMoveFromContent(content: string): MakeMoveToolInput | null {
  const tagPatterns = [
    /<call>([\s\S]*?)<\/call>/gi,
    /<complete>([\s\S]*?)<\/complete>/gi,
    /<rangeset>([\s\S]*?)<\/rangeset>/gi,
  ];

  for (const pattern of tagPatterns) {
    const matches = [...content.matchAll(pattern)];
    for (let i = matches.length - 1; i >= 0; i--) {
      const result = parseTaggedBlock(matches[i][1] ?? '');
      if (result) return result;
    }
  }

  const jsonObjects = [...content.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
  for (let i = jsonObjects.length - 1; i >= 0; i--) {
    const result = parseMovePayload(jsonObjects[i][0]);
    if (result) return result;
  }

  const positionMatches = [...content.matchAll(/"position"\s*:\s*([0-8])/g)];
  const lastPosition = positionMatches.at(-1)?.[1];
  if (lastPosition !== undefined) {
    return { position: Number.parseInt(lastPosition, 10) as Position };
  }

  return null;
}

function normalizeMoveInput(input: string | MakeMoveToolInput): MakeMoveToolInput {
  if (typeof input === 'string') {
    const parsed = parseMovePayload(input);
    if (parsed) return parsed;
    throw new Error(`Invalid tool arguments JSON: ${input}`);
  }

  const parsed = parseMovePayload(input);
  if (parsed) return parsed;

  throw new Error('Invalid tool arguments payload');
}

function extractMoveInput(data: unknown): MakeMoveToolInput {
  const message = getAssistantMessage(data);

  if (!message) {
    throw new Error('No assistant message returned by agent');
  }

  const toolCall = message.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const name = toolCall.function.name;
    if (name && name !== 'make_move') {
      throw new Error(`Unexpected tool name returned by agent: ${name}`);
    }
    return normalizeMoveInput(toolCall.function.arguments);
  }

  if (typeof message.content === 'string') {
    const move = extractMoveFromContent(message.content);
    if (move) return move;

    throw new Error(
      'No move found in response. Expected a make_move tool call or a final line like ' +
      '<call>{"name":"make_move","arguments":{"position":4}}</call>',
    );
  }

  throw new Error('No tool call or move block returned by agent');
}

function resolveMovePosition(
  input: MakeMoveToolInput,
  available: Position[],
): Position {
  return available.includes(input.position) ? input.position : available[0];
}

// ── Agent config ────────────────────────────────────────────────────────────

export interface AgentConfig {
  apiKey: string;
  baseURL?: string;        // default: https://api.openai.com/v1
  model?: string;          // default: gpt-4o-mini
}

// ── Main agent function ─────────────────────────────────────────────────────

export async function agentMove(
  state: GameState,
  config: AgentConfig,
  onToken?: (type: 'thinking' | 'content', token: string) => void,
): Promise<Position> {
  const { apiKey, baseURL = 'https://api.openai.com/v1', model = 'gpt-4o-mini' } = config;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseURL}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(state.currentTurn) },
        { role: 'user', content: buildUserPrompt(state) },
      ],
      tools: [MAKE_MOVE_TOOL],
      tool_choice: 'auto',
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  if (!response.body) {
    throw new Error('No response body from LLM API');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let toolCallArgs = '';
  let resolvedToolInput: MakeMoveToolInput | null = null;
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Determine payload: OpenAI SSE ("data: {...}") or Ollama NDJSON (raw "{...}")
      let payload: string;
      if (trimmed.startsWith('data: ')) {
        payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;
      } else {
        payload = trimmed;
      }

      try {
        const chunk = JSON.parse(payload) as {
          // OpenAI format
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
              tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
            };
            message?: {
              content?: string;
              thinking?: string;
              tool_calls?: Array<{ function?: { name?: string; arguments?: MakeMoveToolInput | string } }>;
            };
          }>;
          // Ollama native format
          message?: {
            content?: string;
            thinking?: string;
            tool_calls?: Array<{ function?: { name?: string; arguments?: MakeMoveToolInput | string } }>;
          };
          done?: boolean;
        };

        // ── OpenAI SSE delta ──────────────────────────────────────────────
        const delta = chunk.choices?.[0]?.delta;
        if (delta) {
          if (delta.reasoning_content) {
            onToken?.('thinking', delta.reasoning_content);
          }
          if (delta.content) {
            fullContent += delta.content;
            onToken?.('content', delta.content);
          }
          const fn = delta.tool_calls?.[0]?.function;
          if (fn?.arguments) {
            toolCallArgs += fn.arguments;
          }
          if (fn?.arguments && fn.name === 'make_move') {
            const parsed = parseMovePayload(toolCallArgs);
            if (parsed) resolvedToolInput = parsed;
          }
          continue;
        }

        // ── Ollama NDJSON message ─────────────────────────────────────────
        const msg = chunk.message ?? chunk.choices?.[0]?.message;
        if (msg) {
          if (msg.thinking) {
            onToken?.('thinking', msg.thinking);
          }
          if (msg.content) {
            fullContent += msg.content;
            onToken?.('content', msg.content);
          }
          const fn = msg.tool_calls?.[0]?.function;
          if (fn?.arguments) {
            const args = fn.arguments;
            const parsed = parseMovePayload(typeof args === 'string' ? args : args);
            if (parsed && (!fn.name || fn.name === 'make_move')) {
              resolvedToolInput = parsed;
            }
          }
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  const available = getAvailablePositions(state.board);

  const streamedToolInput = toolCallArgs ? parseMovePayload(toolCallArgs) : null;
  const toolInput = resolvedToolInput ?? streamedToolInput;
  if (toolInput) {
    return resolveMovePosition(toolInput, available);
  }

  const contentMove = extractMoveFromContent(fullContent);
  if (contentMove) {
    return resolveMovePosition(contentMove, available);
  }

  const fakeData = { choices: [{ message: { content: fullContent } }] };
  const input = extractMoveInput(fakeData);
  return resolveMovePosition(input, available);
}
