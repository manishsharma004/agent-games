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
Always call make_move — do not respond with plain text.`;
}

function buildUserPrompt(state: GameState): string {
  const available = getAvailablePositions(state.board);
  return `Current board:\n\n${boardToString(state.board)}\n\nAvailable positions: ${available.join(', ')}\nYour turn (${state.currentTurn}). Make your move.`;
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
): Promise<Position> {
  const { apiKey, baseURL = 'https://api.openai.com/v1', model = 'gpt-4o-mini' } = config;

  const response = await fetch(`${baseURL}/chat/completions`, {
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
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('No tool call returned by agent');

  const input: MakeMoveToolInput = JSON.parse(toolCall.function.arguments);
  const available = getAvailablePositions(state.board);

  // Safety: if agent picks an occupied cell, fall back to first available
  const position = available.includes(input.position as Position)
    ? (input.position as Position)
    : available[0];

  return position;
}
