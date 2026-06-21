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
        <div className="chat-empty">
          <strong>Agent chat ready</strong>
          <span>The model will stream its reasoning and move here.</span>
        </div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message--${msg.role}`}>
            <div className="chat-message__meta">
              {msg.role === 'user' ? 'You' : 'Agent'}
            </div>
            <div className="chat-message__bubble">
              {msg.role === 'assistant' && msg.thinking && (
                <details className="chat-thinking" open>
                  <summary className="chat-thinking__summary">Thinking</summary>
                  <div className="chat-thinking__body">{msg.thinking}</div>
                </details>
              )}
              {msg.text && <div className="chat-message__text">{msg.text}</div>}
              {msg.role === 'assistant' && msg.move !== undefined && (
                <div className="chat-message__move">📍 Move: {msg.move}</div>
              )}
              {msg.role === 'assistant' && !msg.text && !msg.thinking && msg.move === undefined && (
                <span className="chat-message__placeholder">…</span>
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

