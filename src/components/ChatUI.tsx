import React from 'react'
import { BoardPreview } from './BoardPreview'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from './ui/chat-container'
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from './ui/message'
import { Markdown } from './ui/markdown'
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from './ui/chain-of-thought'
import { Tool, type ToolPart } from './ui/tool'
import { cn } from '@/lib/utils'
import type { Board } from '../game/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  board?: Board
  thinking?: string
  move?: number
  tools?: ToolPart[]
}

interface ChatUIProps {
  messages: ChatMessage[]
  className?: string
  isStreaming?: boolean
}

const THINK_BLOCK_RE = /<(?:think|redacted_thinking)>([\s\S]*?)<\/(?:think|redacted_thinking)>/gi
const THINK_TAG_RE = /<\/?(?:think|redacted_thinking)>/gi
const CONTROL_BLOCK_RE = /<(complete|call|rangeset)>[\s\S]*?<\/\1>/gi

function normalizeTextLayout(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeReasoningLayout(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function shouldFoldIntoReasoning(text: string): boolean {
  if (!text) return false

  // Keep tactical/tooling chatter and chain-of-thought steps out of the visible bubble.
  return (
    /make_move|current board|available positions|your turn|tool|position\s*[:=]/i.test(text) ||
    /^##\s*Step\s*\d+/m.test(text)
  )
}

function splitAssistantContent(text: string): { visibleText: string; extractedThinking: string } {
  let extractedThinking = ''
  let visibleText = text

  visibleText = visibleText.replace(THINK_BLOCK_RE, (_full, inner) => {
    if (typeof inner === 'string' && inner.trim()) {
      extractedThinking += `${inner.trim()}\n`
    }
    return ''
  })

  // Clean up unmatched tag fragments from partial streams.
  visibleText = visibleText.replace(THINK_TAG_RE, '')

  // Hide command/control payload blocks from chat text.
  visibleText = visibleText.replace(CONTROL_BLOCK_RE, '')

  return {
    visibleText: visibleText.trim(),
    extractedThinking: extractedThinking.trim(),
  }
}

interface ChainStep {
  title: string
  body: string
}

function parseChainSteps(markdown: string): ChainStep[] {
  const stepRegex = /^##\s*Step\s*\d+\s*:\s*(.+)$/gim
  const headers = [...markdown.matchAll(stepRegex)]

  if (headers.length === 0) return []

  return headers.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = headers[index + 1]?.index ?? markdown.length
    const body = markdown.slice(start, end).trim()

    return {
      title: match[1].trim(),
      body: body || '- No details provided.',
    }
  })
}

function getReasoningSteps(markdown: string): ChainStep[] {
  const parsed = parseChainSteps(markdown)
  if (parsed.length > 0) return parsed

  if (!markdown.trim()) return []

  return [
    {
      title: 'Reasoning',
      body: markdown,
    },
  ]
}

export const ChatUI: React.FC<ChatUIProps> = ({ messages, className, isStreaming }) => {
  return (
    <ChatContainerRoot className={className}>
      <ChatContainerContent className="space-y-1">
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
              const isBoardPrompt = msg.text.includes('Current board:')
              const availableMatch = msg.text.match(/Available positions:\s*([\d,\s]+)/)
              const available = availableMatch?.[1]
                ?.split(',')
                .map((n) => n.trim())
                .filter(Boolean)
              const turnMatch = msg.text.match(/Your turn \(([XO])\)/)

              return (
                <Message
                  key={msg.id}
                  className={cn('pk-message pk-message--user flex-row-reverse')}
                >
                  <MessageAvatar alt="You" src="" fallback="You" className="h-9 w-9" />
                  <div className="pk-message-content pk-message-content--user">
                    {isBoardPrompt && msg.board ? (
                      <div className="pk-message-bubble rounded-lg bg-secondary px-3 py-2 text-foreground">
                        <div className="pk-board-prompt">
                          <span className="pk-board-prompt__label">Current board</span>
                          <BoardPreview board={msg.board} />
                          {available && available.length > 0 && (
                            <span className="pk-board-prompt__meta">
                              Open: {available.join(', ')}
                              {turnMatch ? ` · Turn ${turnMatch[1]}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <MessageContent markdown className="pk-message-bubble pk-markdown">
                        {msg.text}
                      </MessageContent>
                    )}
                  </div>
                </Message>
              )
            }

            const { visibleText, extractedThinking } = splitAssistantContent(msg.text)
            const cleanedVisibleText = normalizeTextLayout(visibleText)
            const foldVisibleIntoReasoning = shouldFoldIntoReasoning(cleanedVisibleText)
            const visibleAssistantText = foldVisibleIntoReasoning ? '' : cleanedVisibleText
            const reasoningContent = normalizeReasoningLayout(
              [
                msg.thinking,
                extractedThinking,
                foldVisibleIntoReasoning ? cleanedVisibleText : '',
              ]
                .filter(Boolean)
                .join('\n\n'),
            )
            const chainSteps = getReasoningSteps(reasoningContent)
            const hasRenderableContent = Boolean(
              visibleAssistantText || reasoningContent || msg.move !== undefined,
            )

            return (
              <Message key={msg.id} className="pk-message pk-message--assistant">
                <MessageAvatar alt="Assistant" src="" fallback="AI" className="h-9 w-9" />
                <div className="pk-message-content pk-message-content--assistant">
                  <div className="pk-message-label">
                    <span>Assistant</span>
                    {streaming && <span className="pk-streaming-dot">Live</span>}
                  </div>
                  {reasoningContent && (
                    <div className="pk-thinking-shell">
                      <div className="pk-thinking-label">Thinking</div>
                      <ChainOfThought className="pk-cot-root">
                        {chainSteps.map((step, stepIdx) => (
                          <ChainOfThoughtStep
                            key={`${msg.id}-cot-step-${stepIdx}`}
                            defaultOpen={streaming || chainSteps.length === 1 || stepIdx === chainSteps.length - 1}
                            className="pk-cot-step"
                          >
                            <ChainOfThoughtTrigger
                              swapIconOnHover={false}
                              className="pk-cot-trigger"
                            >
                              {chainSteps.length === 1
                                ? step.title
                                : `Step ${stepIdx + 1}: ${step.title}`}
                            </ChainOfThoughtTrigger>
                            <ChainOfThoughtContent className="pk-cot-content">
                              <ChainOfThoughtItem className="pk-cot-item">
                                <Markdown
                                  id={`${msg.id}-cot-markdown-${stepIdx}`}
                                  className="pk-markdown"
                                >
                                  {step.body}
                                </Markdown>
                              </ChainOfThoughtItem>
                            </ChainOfThoughtContent>
                          </ChainOfThoughtStep>
                        ))}
                      </ChainOfThought>
                    </div>
                  )}
                  {visibleAssistantText && (
                    <MessageContent
                      markdown
                      id={`assistant-${msg.id}`}
                      className="pk-message-bubble pk-assistant-text pk-markdown"
                    >
                      {visibleAssistantText}
                    </MessageContent>
                  )}
                  {msg.tools?.map((toolPart, toolIdx) => (
                    <Tool
                      key={`${msg.id}-tool-${toolIdx}-${toolPart.state}`}
                      toolPart={toolPart}
                      defaultOpen={streaming || toolPart.state === 'output-error'}
                      className="pk-tool-card"
                    />
                  ))}
                  {msg.move !== undefined && (
                    <MessageActions className="pk-message-actions">
                      <span className="pk-move-chip">Move {msg.move}</span>
                    </MessageActions>
                  )}
                  {!hasRenderableContent && (
                    <span className="text-muted-foreground text-sm">Thinking…</span>
                  )}
                </div>
              </Message>
            )
          })
        )}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
    </ChatContainerRoot>
  )
}

export default ChatUI
