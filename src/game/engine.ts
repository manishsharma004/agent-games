import type { Board, Cell, GameState, Marker, Move, Position } from './types';

const WINNING_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export function createInitialState(): GameState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    currentTurn: 'X',
    status: 'idle',
    winner: null,
    moves: [],
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, status: 'playing' };
}

export function checkWinner(board: Board): Marker | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Marker;
    }
  }
  return null;
}

export function isDraw(board: Board): boolean {
  return board.every((cell: Cell) => cell !== null);
}

/**
 * Programmable interface: apply a move to the game state.
 * Returns a new state (immutable) or throws if the move is invalid.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.status !== 'playing') throw new Error('Game is not in playing state');
  if (move.marker !== state.currentTurn) throw new Error(`It is ${state.currentTurn}'s turn`);
  if (state.board[move.position] !== null) throw new Error(`Position ${move.position} is already occupied`);

  const newBoard = [...state.board] as Board;
  newBoard[move.position] = move.marker;

  const winner = checkWinner(newBoard);
  const draw = !winner && isDraw(newBoard);

  return {
    board: newBoard,
    currentTurn: state.currentTurn === 'X' ? 'O' : 'X',
    status: winner ? 'won' : draw ? 'draw' : 'playing',
    winner,
    moves: [...state.moves, move],
  };
}

export function getAvailablePositions(board: Board): Position[] {
  return board
    .map((cell, i) => (cell === null ? i : null))
    .filter((i): i is Position => i !== null);
}

export function getWinningLine(board: Board): [number, number, number] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}
