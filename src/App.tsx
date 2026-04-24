import { useCallback, useEffect, useRef, useState } from 'react'
import { GameBoard } from './components/GameBoard'
import { SetupPanel } from './components/SetupPanel'
import type { AgentConfig } from './game/agent'
import { agentMove } from './game/agent'
import { applyMove, createInitialState, startGame } from './game/engine'
import type { GameState, PlayerConfig, Position } from './game/types'
import './App.css'

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState())
  const [players, setPlayers] = useState<PlayerConfig>({ X: 'human', O: 'agent' })
  const [agentConfig, setAgentConfig] = useState<AgentConfig | undefined>()
  const [agentThinking, setAgentThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const agentBusy = useRef(false)

  const isPlaying = gameState.status === 'playing'
  const isOver = gameState.status === 'won' || gameState.status === 'draw'
  const currentPlayerType = players[gameState.currentTurn]

  // Auto-trigger agent moves
  useEffect(() => {
    if (!isPlaying || currentPlayerType !== 'agent' || agentBusy.current || !agentConfig) return
    agentBusy.current = true
    setAgentThinking(true)
    setError(null)
    agentMove(gameState, agentConfig)
      .then((position: Position) => {
        setGameState((prev) => applyMove(prev, { position, marker: prev.currentTurn }))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setAgentThinking(false)
        agentBusy.current = false
      })
  }, [gameState, isPlaying, currentPlayerType, agentConfig])

  const handleCellClick = useCallback(
    (position: Position) => {
      if (!isPlaying || currentPlayerType !== 'human' || agentThinking) return
      setError(null)
      try {
        setGameState((prev) => applyMove(prev, { position, marker: prev.currentTurn }))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [isPlaying, currentPlayerType, agentThinking],
  )

  const handleStart = useCallback((p: PlayerConfig, cfg?: AgentConfig) => {
    setPlayers(p)
    setAgentConfig(cfg)
    setError(null)
    agentBusy.current = false
    setGameState(startGame(createInitialState()))
  }, [])

  const handleRestart = useCallback(() => {
    agentBusy.current = false
    setAgentThinking(false)
    setError(null)
    setGameState(startGame(createInitialState()))
  }, [])

  const handleChangeSetup = useCallback(() => {
    agentBusy.current = false
    setAgentThinking(false)
    setError(null)
    setGameState(createInitialState())
  }, [])

  if (gameState.status === 'idle') {
    return (
      <div className="app">
        <SetupPanel onStart={handleStart} />
      </div>
    )
  }

  const statusText = (() => {
    if (gameState.status === 'won')
      return `${gameState.winner} wins! ${players[gameState.winner!] === 'agent' ? '🤖' : '🧑'}`
    if (gameState.status === 'draw') return "It's a draw! 🤝"
    if (agentThinking) return `${gameState.currentTurn} is thinking… 🤖`
    return `${gameState.currentTurn}'s turn ${currentPlayerType === 'agent' ? '🤖' : '🧑'}`
  })()

  return (
    <div className="app">
      <div className="game-container">
        <h1 className="title">Tic-Tac-Toe</h1>
        <div className={`status-bar${isOver ? ' status-bar--over' : ''}`}>{statusText}</div>
        {error && <div className="error-msg">⚠️ {error}</div>}
        <GameBoard
          board={gameState.board}
          onCellClick={handleCellClick}
          disabled={!isPlaying || currentPlayerType === 'agent' || agentThinking}
        />
        <div className="action-row">
          <button className="restart-btn" onClick={handleRestart}>
            {isOver ? '🔄 Play Again' : '↩ Restart'}
          </button>
          {isOver && (
            <button className="setup-btn" onClick={handleChangeSetup}>
              ⚙️ Change Setup
            </button>
          )}
        </div>
        <div className="players-legend">
          {(['X', 'O'] as const).map((m) => (
            <span key={m} className={`legend-item legend-item--${m.toLowerCase()}`}>
              <strong>{m}</strong> {players[m] === 'agent' ? '🤖 Agent' : '🧑 Human'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App