import type { Board, Position } from '../game/types';
import { getWinningLine } from '../game/engine';

interface BoardProps {
  board: Board;
  onCellClick?: (position: Position) => void;
  disabled?: boolean;
}

export function GameBoard({ board, onCellClick, disabled }: BoardProps) {
  const winLine = getWinningLine(board);

  return (
    <div className="board">
      {board.map((cell, i) => {
        const isWinning = winLine?.includes(i) ?? false;
        return (
          <button
            key={i}
            className={`cell ${cell ? `cell--${cell.toLowerCase()}` : ''} ${isWinning ? 'cell--winning' : ''}`}
            onClick={() => onCellClick?.(i as Position)}
            disabled={disabled || cell !== null}
            aria-label={cell ? `${cell} at position ${i}` : `Empty position ${i}`}
          >
            {cell}
          </button>
        );
      })}
    </div>
  );
}
