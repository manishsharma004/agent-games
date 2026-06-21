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
Use the make_move tool to place your marker. 
Think strategically: win if possible, block the opponent, otherwise take the best available position.
If tool calling is unavailable, return ONLY a JSON object inside <complete></complete> tags with no other text:
<complete>
{
  "name": "make_move",
  "arguments": {
    "position": 0
  }
}
</complete>`;
}

export function buildUserPrompt(state: GameState): string {
  const available = getAvailablePositions(state.board);
  return `Current board:\n\n${boardToString(state.board)}\n\nAvailable positions: ${available.join(', ')}\nYour turn (${state.currentTurn}). Make your move.`;
}

interface LLMMessage {
  content?: string;
  tool_calls?: Array<{
    function?: {
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

function parseCompleteBlock(content: string): MakeMoveToolInput {
  const matches = [...content.matchAll(/<complete>([\s\S]*?)<\/complete>/g)];
  const block = matches.at(-1)?.[1]?.trim();

  if (!block) {
    throw new Error('No <complete> block returned by agent');
  }

  try {
    const parsed = JSON.parse(block);

    // Handle nested structure: {"name": "make_move", "arguments": {"position": 0}}
    if (parsed && typeof parsed === 'object' && 'arguments' in parsed && parsed.arguments) {
      const position = parsed.arguments.position;
      if (typeof position === 'number' && position >= 0 && position <= 8) {
        return { position: position as Position };
      }
      throw new Error(`Invalid position value: ${position}`);
    }

    // Handle direct structure: {"position": 0}
    if (parsed && typeof parsed === 'object' && 'position' in parsed) {
      const position = parsed.position;
      if (typeof position === 'number' && position >= 0 && position <= 8) {
        return { position: position as Position };
      }
      throw new Error(`Invalid position value: ${position}`);
    }

    throw new Error('Missing position in parsed JSON');
  } catch (error) {
    throw new Error(`Failed to parse <complete> block JSON: ${error instanceof Error ? error.message : String(error)}\n\nBlock content: ${block}`);
  }
}

function parseCallBlock(content: string): MakeMoveToolInput {
  const matches = [...content.matchAll(/<call>([\s\S]*?)<\/call>/g)];
  const block = matches.at(-1)?.[1];

  if (!block) {
    throw new Error('No <call> block returned by agent');
  }

  const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
  const argsMatch = block.match(/<args>([\s\S]*?)<\/args>/);
  const name = nameMatch?.[1]?.trim();
  const args = argsMatch?.[1]?.trim();

  if (name !== 'make_move') {
    throw new Error(`Unexpected call name returned by agent: ${name ?? 'unknown'}`);
  }

  if (!args) {
    throw new Error('No <args> payload returned inside <call> block');
  }

  return JSON.parse(args) as MakeMoveToolInput;
}

function parseRangesetBlock(content: string): MakeMoveToolInput {
  const matches = [...content.matchAll(/<rangeset>([\s\S]*?)<\/rangeset>/g)];
  const block = matches.at(-1)?.[1]?.trim();

  if (!block) {
    throw new Error('No <rangeset> block returned by agent');
  }

  try {
    const parsed = JSON.parse(block);

    // Handle nested structure: {"name": "make_move", "arguments": {"position": 0}}
    if (parsed && typeof parsed === 'object' && 'arguments' in parsed && parsed.arguments) {
      const position = parsed.arguments.position;
      if (typeof position === 'number' && position >= 0 && position <= 8) {
        return { position: position as Position };
      }
      throw new Error(`Invalid position value: ${position}`);
    }

    // Handle direct structure: {"position": 0}
    if (parsed && typeof parsed === 'object' && 'position' in parsed) {
      const position = parsed.position;
      if (typeof position === 'number' && position >= 0 && position <= 8) {
        return { position: position as Position };
      }
      throw new Error(`Invalid position value: ${position}`);
    }

    throw new Error('Missing position in parsed JSON');
  } catch (error) {
    throw new Error(`Failed to parse <rangeset> block JSON: ${error instanceof Error ? error.message : String(error)}\n\nBlock content: ${block}`);
  }
}

function normalizeMoveInput(input: string | MakeMoveToolInput): MakeMoveToolInput {
  if (typeof input === 'string') {
    return JSON.parse(input) as MakeMoveToolInput;
  }

  return input;
}

function extractMoveInput(data: unknown): MakeMoveToolInput {
  const message = getAssistantMessage(data);

  if (!message) {
    throw new Error('No assistant message returned by agent');
  }

  const toolCall = message.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return normalizeMoveInput(toolCall.function.arguments);
  }

  if (typeof message.content === 'string') {
    // Try parsing in order: <complete>, <rangeset>, <call>
    try {
      return parseCompleteBlock(message.content);
    } catch (completeError) {
      try {
        return parseRangesetBlock(message.content);
      } catch (rangesetError) {
        try {
          return parseCallBlock(message.content);
        } catch (callError) {
          throw new Error(
            `Failed to parse any block format:\n` +
            `- <complete>: ${completeError instanceof Error ? completeError.message : String(completeError)}\n` +
            `- <rangeset>: ${rangesetError instanceof Error ? rangesetError.message : String(rangesetError)}\n` +
            `- <call>: ${callError instanceof Error ? callError.message : String(callError)}`
          );
        }
      }
    }
  }

  throw new Error('No tool call or fallback block returned by agent');
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

  const response = await fetch(`${baseURL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(state.currentTurn) },
        { role: 'user', content: buildUserPrompt(state) },
      ],
      tools: [MAKE_MOVE_TOOL],
      tool_choice: { type: 'function', function: { name: 'make_move' } },
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
              tool_calls?: Array<{ function?: { arguments?: string } }>;
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
          if (delta.tool_calls?.[0]?.function?.arguments) {
            toolCallArgs += delta.tool_calls[0].function.arguments;
          }
          continue;
        }

        // ── Ollama NDJSON message ─────────────────────────────────────────
        const msg = chunk.message;
        if (msg) {
          if (msg.thinking) {
            onToken?.('thinking', msg.thinking);
          }
          if (msg.content) {
            fullContent += msg.content;
            onToken?.('content', msg.content);
          }
          // Ollama tool calls arrive with already-parsed arguments objects
          if (msg.tool_calls?.[0]?.function?.arguments) {
            const args = msg.tool_calls[0].function.arguments;
            resolvedToolInput = normalizeMoveInput(
              typeof args === 'string' ? args : JSON.stringify(args),
            );
          }
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  const available = getAvailablePositions(state.board);

  // Prefer structured tool call if present (Ollama resolves args eagerly; OpenAI accumulates a string)
  const toolInput = resolvedToolInput ?? (toolCallArgs ? normalizeMoveInput(toolCallArgs) : null);
  if (toolInput) {
    return available.includes(toolInput.position as Position)
      ? (toolInput.position as Position)
      : available[0];
  }

  // Fall back to parsing content blocks
  const fakeData = { choices: [{ message: { content: fullContent } }] };
  const input = extractMoveInput(fakeData);
  const position = available.includes(input.position as Position)
    ? (input.position as Position)
    : available[0];
  return position;
}
