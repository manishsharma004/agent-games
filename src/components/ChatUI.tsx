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
            return <Message key={msg.id} role="user" content={msg.text} />
          }

          return (
            <Message key={msg.id} role="assistant" isStreaming={streaming}>
              {msg.thinking && (
                <Reasoning
                  content={msg.thinking}
                  isOpen={true}
                  isStreaming={streaming}
                />
              )}
              {msg.text && <div className="text-sm">{msg.text}</div>}
              {msg.move !== undefined && (
                <div className="text-sm mt-1">📍 Move: {msg.move}</div>
              )}
              {!msg.text && !msg.thinking && msg.move === undefined && (
                <span className="text-muted-foreground">…</span>
              )}
            </Message>
          )
        })
      )}
    </ChatContainer>
  )
}

export default ChatUI

