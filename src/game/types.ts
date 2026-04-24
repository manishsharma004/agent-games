export type Marker = 'X' | 'O';

/** Board position index 0-8 (row-major order):
 *  0 | 1 | 2
 *  ---------
 *  3 | 4 | 5
 *  ---------
 *  6 | 7 | 8
 */
export type Position = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Move {
  position: Position;
  marker: Marker;
}

export type Cell = Marker | null;
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

export type GameStatus = 'idle' | 'playing' | 'won' | 'draw';

export interface GameState {
  board: Board;
  currentTurn: Marker;
  status: GameStatus;
  winner: Marker | null;
  moves: Move[];
}

export type PlayerType = 'human' | 'agent';

export interface PlayerConfig {
  X: PlayerType;
  O: PlayerType;
}

// ── Agent / LLM tool-call interface ────────────────────────────────────────

export interface MakeMoveToolInput {
  position: Position;
}

export interface ToolCall {
  id: string;
  name: 'make_move';
  input: MakeMoveToolInput;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}
