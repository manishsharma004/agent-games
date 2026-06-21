import React from 'react'
import { ChatContainer } from './ui/chat-container'
import { Message } from './ui/message'
import { Reasoning } from './ui/reasoning'

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
  isStreaming?: boolean
}

export const ChatUI: React.FC<ChatUIProps> = ({ messages, className, isStreaming }) => {
  const renderBody = (text: string) => {
    if (!text.trim()) return null

    // Preserve board formatting in user prompt logs.
    if (text.includes('Current board:') || text.includes('\n')) {
      return <pre className="pk-chat-pre">{text}</pre>
    }

    return <div className="text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
  }

  return (
    <ChatContainer className={className}>
      {messages.length === 0 ? (
        <div className="chat-empty">
          <strong>Agent chat ready</strong>
          <span>The model will stream its reasoning and move here.</span>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isLastMsg = index === messages.length - 1
          const streaming = isLastMsg && !!isStreaming

          if (msg.role === 'user') {
            return (
              <Message
                key={msg.id}
                role="user"
                className="pk-message pk-message--user"
                avatar={<div className="pk-avatar pk-avatar--user">You</div>}
                content={renderBody(msg.text)}
              />
            )
          }

          const hasVisibleContent = Boolean(msg.text || msg.thinking || msg.move !== undefined)

          return (
            <Message
              key={msg.id}
              role="assistant"
              className="pk-message pk-message--assistant"
              isStreaming={streaming}
              avatar={<div className="pk-avatar pk-avatar--assistant">AI</div>}
              actions={
                msg.move !== undefined ? (
                  <span className="pk-move-chip">Move {msg.move}</span>
                ) : undefined
              }
            >
              <div className="pk-message-label">
                <span>Assistant</span>
                {streaming && <span className="pk-streaming-dot">Live</span>}
              </div>
              {msg.thinking && (
                <Reasoning
                  content={msg.thinking}
                  isOpen={streaming}
                  isStreaming={streaming}
                />
              )}
              {msg.text && <div className="pk-assistant-text">{renderBody(msg.text)}</div>}
              {!hasVisibleContent && (
                <span className="text-muted-foreground text-sm">Thinking…</span>
              )}
            </Message>
          )
        })
      )}
    </ChatContainer>
  )
}

export default ChatUI

