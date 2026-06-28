import type { Board } from '../game/types'

interface BoardPreviewProps {
  board: Board
  className?: string
}

export function BoardPreview({ board, className }: BoardPreviewProps) {
  return (
    <div className={className ?? 'board-preview'} aria-label="Board state">
      {board.map((cell, index) => (
        <div
          key={index}
          className={`board-preview__cell${cell ? ` board-preview__cell--${cell.toLowerCase()}` : ''}`}
        >
          {cell ?? ''}
        </div>
      ))}
    </div>
  )
}
