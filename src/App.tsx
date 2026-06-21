import { useCallback, useEffect, useRef, useState } from 'react'
import { GameBoard } from './components/GameBoard'
import { SetupPanel } from './components/SetupPanel'
import type { AgentConfig } from './game/agent'
import { agentMove, buildUserPrompt } from './game/agent'
import { applyMove, createInitialState, startGame } from './game/engine'
import type { GameState, PlayerConfig, Position } from './game/types'
import './App.css'

interface ChatMessage {
  id: number
  role: 'user' | 'agent'
  text: string
  thinking?: string
  move?: Position
}

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState())
  const [players, setPlayers] = useState<PlayerConfig>({ X: 'human', O: 'agent' })
  const [agentConfig, setAgentConfig] = useState<AgentConfig | undefined>()
  const [agentThinking, setAgentThinking] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const agentBusy = useRef(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const nextMsgId = useRef(0)

  const isPlaying = gameState.status === 'playing'
  const isOver = gameState.status === 'won' || gameState.status === 'draw'
  const currentPlayerType = players[gameState.currentTurn]

  // Auto-trigger agent moves
  useEffect(() => {
    if (!isPlaying || currentPlayerType !== 'agent' || agentBusy.current || !agentConfig) return
    agentBusy.current = true
    setAgentThinking(true)
    setError(null)

    const userMsgId = nextMsgId.current++
    const agentMsgId = nextMsgId.current++
    setChatMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: buildUserPrompt(gameState) },
      { id: agentMsgId, role: 'agent', text: '', thinking: '' },
    ])

    agentMove(gameState, agentConfig, (type, token) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? type === 'thinking'
              ? { ...m, thinking: (m.thinking ?? '') + token }
              : { ...m, text: m.text + token }
            : m,
        ),
      )
      requestAnimationFrame(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        }
      })
    })
      .then((position: Position) => {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === agentMsgId ? { ...m, move: position } : m)),
        )
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
    setChatMessages([])
    setError(null)
    setGameState(startGame(createInitialState()))
  }, [])

  const handleChangeSetup = useCallback(() => {
    agentBusy.current = false
    setAgentThinking(false)
    setChatMessages([])
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
        {chatMessages.length > 0 && (
          <div className="chat-panel" ref={chatScrollRef}>
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
                <div className="chat-msg__label">
                  {msg.role === 'user' ? '🧑 You' : '🤖 Agent'}
                </div>
                <div className="chat-msg__bubble">
                  {msg.role === 'agent' && (msg.thinking ?? '').length > 0 && (
                    <details className="chat-thinking">
                      <summary className="chat-thinking__summary">🧠 Thinking</summary>
                      <pre className="chat-thinking__body">{msg.thinking}</pre>
                    </details>
                  )}
                  {msg.text && (
                    <p className="chat-msg__text">{msg.text}</p>
                  )}
                  {msg.role === 'agent' && msg.move !== undefined && (
                    <p className="chat-msg__move">📍 Placed at position {msg.move}</p>
                  )}
                  {msg.role === 'agent' && !msg.text && !(msg.thinking ?? '').length && msg.move === undefined && (
                    <span className="chat-msg__placeholder">…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App