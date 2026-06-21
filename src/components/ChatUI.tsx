import React, { useEffect, useRef } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  thinking?: string
  move?: number
}

interface ChatUIProps {
  messages: ChatMessage[]
  className?: string
}

export const ChatUI: React.FC<ChatUIProps> = ({ messages, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className={className ? `chat-panel ${className}` : 'chat-panel'}>
      {messages.length === 0 ? (
        <div className="chat-empty">No messages yet. The agent will stream its reasoning and moves here.</div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
          <div className="chat-msg__label">
            {msg.role === 'user' ? '🧑 You' : '🤖 Agent'}
          </div>
          <div className="chat-msg__bubble">
            {msg.role === 'assistant' && msg.thinking && (
              <details className="chat-thinking" open>
                <summary className="chat-thinking__summary">💭 Thinking Process</summary>
                <div className="chat-thinking__body">{msg.thinking}</div>
              </details>
            )}
            {msg.text && <div className="chat-msg__text">{msg.text}</div>}
            {msg.role === 'assistant' && msg.move !== undefined && (
              <div className="chat-msg__move">📍 Placed at position {msg.move}</div>
            )}
            {msg.role === 'assistant' && !msg.text && !msg.thinking && msg.move === undefined && (
              <span className="chat-msg__placeholder">…</span>
            )}
          </div>
        </div>
          ))
      )}
      <div ref={scrollRef} />
    </div>
  )
}

export default ChatUI
