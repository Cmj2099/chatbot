import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, type ChatMessage } from '../api/chat';
import './Chatbot.css';

interface DisplayMessage extends ChatMessage {
  id: string;
  isError?: boolean;
}

const INITIAL_MESSAGE: DisplayMessage = {
  id: 'init-msg',
  role: 'assistant',
  content:
    '안녕하세요! 📚 영어 단어 퀴즈 챗봇입니다.\n\n어떤 주제나 난이도로 영어 단어를 공부해 보고 싶으신가요?\n아래 추천 버튼을 누르시거나, 원하시는 주제(예: 해외여행, 비즈니스 미팅, 카페 주문)와 난이도(초급/중급/고급)를 편하게 말씀해 주세요!',
};

const SUGGESTED_TOPICS = [
  '✈️ 해외여행 필수 회화 (초급)',
  '💼 비즈니스 이메일 & 미팅 (중급)',
  '☕ 카페 & 식당 주문하기 (초급)',
  '🎯 토익/수능 빈출 어휘 (고급)',
  '🍿 미드 & 영화 자주 나오는 표현 (중급)',
];

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 메시지 목록 갱신 시 최하단으로 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 대화 초기화
  const handleReset = () => {
    if (window.confirm('대화를 처음부터 다시 시작하시겠습니까?')) {
      setMessages([INITIAL_MESSAGE]);
      setInput('');
    }
  };

  // 메시지 전송 처리
  const handleSend = async (textToSend?: string) => {
    const rawContent = textToSend ?? input;
    const content = rawContent.trim();
    if (!content || isLoading) return;

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // 서버로는 role과 content만 전달 (초기 안내 메시지 포함 또는 제외 가능하나 맥락 유지를 위해 전달)
      const payload: ChatMessage[] = newMessages
        .filter((m) => !m.isError)
        .map(({ role, content: msgContent }) => ({
          role,
          content: msgContent,
        }));

      const reply = await sendChatMessage(payload);

      const assistantMessage: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: DisplayMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ 오류가 발생했습니다:\n${error?.message || '잠시 후 다시 시도해 주세요.'}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // 키보드 엔터 처리 (Shift + Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      {/* 헤더 */}
      <header className="chatbot-header">
        <div className="chatbot-header-info">
          <div className="chatbot-avatar" aria-hidden="true">
            📖
          </div>
          <div>
            <h1 className="chatbot-title">영어 단어 퀴즈 챗봇</h1>
            <span className="chatbot-badge">OpenAI gpt-6-luna</span>
          </div>
        </div>
        <div className="chatbot-header-actions">
          <button
            type="button"
            className="reset-button"
            onClick={handleReset}
            title="대화 초기화"
          >
            새 대화
          </button>
        </div>
      </header>

      {/* 대화 영역 */}
      <main className="chatbot-messages" aria-live="polite">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${msg.role} ${msg.isError ? 'error-row' : ''}`}
          >
            <div className="message-sender-avatar" aria-hidden="true">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div
              className={`message-bubble ${msg.isError ? 'message-error' : ''}`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-row assistant">
            <div className="message-sender-avatar" aria-hidden="true">
              🤖
            </div>
            <div className="message-bubble typing-indicator" aria-label="답변 생성 중">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 추천 주제 칩 */}
      <div className="quick-topics">
        <span className="quick-topics-label">추천 주제:</span>
        {SUGGESTED_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            className="topic-chip"
            disabled={isLoading}
            onClick={() => handleSend(topic)}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* 입력 영역 */}
      <footer className="chatbot-input-area">
        <form
          className="input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="주제(예: 여행, 비즈니스)나 난이도, 또는 퀴즈의 정답을 입력하세요..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? '생성 중...' : '전송'}
          </button>
        </form>
        <div className="input-hint">Enter로 전송, Shift + Enter로 줄바꿈</div>
      </footer>
    </div>
  );
};

export default Chatbot;

