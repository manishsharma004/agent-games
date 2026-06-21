import { useState } from 'react';
import type { AgentConfig } from '../game/agent';
import type { PlayerConfig } from '../game/types';

interface SetupPanelProps {
  onStart: (players: PlayerConfig, agentConfig?: AgentConfig) => void;
}

export function SetupPanel({ onStart }: SetupPanelProps) {
  const [xType, setXType] = useState<'human' | 'agent'>('human');
  const [oType, setOType] = useState<'human' | 'agent'>('agent');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('hf.co/mradermacher/VibeThinker-3B-i1-GGUF:Q4_K_M');
  const [baseURL, setBaseURL] = useState('http://192.168.29.30:11434/api/chat');

  const needsAgent = xType === 'agent' || oType === 'agent';

  function handleStart() {
    const agentConfig: AgentConfig | undefined = needsAgent
      ? { apiKey: apiKey.trim(), model, baseURL: baseURL.trim() || 'http://192.168.29.30:11434/api/chat' }
      : undefined;
    onStart({ X: xType, O: oType }, agentConfig);
  }

  return (
    <div className="setup-panel">
      <h1 className="title">Tic-Tac-Toe</h1>
      <p className="subtitle">Human vs Agent</p>

      <div className="player-config">
        {(['X', 'O'] as const).map((marker) => {
          const type = marker === 'X' ? xType : oType;
          const setType = marker === 'X' ? setXType : setOType;
          return (
            <div key={marker} className="player-row">
              <span className={`marker marker--${marker.toLowerCase()}`}>{marker}</span>
              <div className="toggle-group">
                {(['human', 'agent'] as const).map((t) => (
                  <button
                    key={t}
                    className={`toggle-btn ${type === t ? 'toggle-btn--active' : ''}`}
                    onClick={() => setType(t)}
                  >
                    {t === 'human' ? '🧑 Human' : '🤖 Agent'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {needsAgent && (
        <div className="agent-config">
          <h3>Agent (Ollama) Config</h3>
          <label>
            Base URL
            <input
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="http://localhost:11434/api/chat"
            />
          </label>
          <label>
            Model
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemma4:e2b"
            />
          </label>
          <label>
            API Key <span className="optional">(optional — not needed for Ollama)</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank for Ollama"
            />
          </label>
        </div>
      )}

      <button className="start-btn" onClick={handleStart}>
        Start Game
      </button>
    </div>
  );
}