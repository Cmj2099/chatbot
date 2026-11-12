import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessageStream, type ChatMessage } from '../api/chat';
import './Chatbot.css';

interface DisplayMessage extends ChatMessage {
  id: string;
  isError?: boolean;
}

const INITIAL_MESSAGE: DisplayMessage = {
  id: 'init-msg',
  role: 'assistant',
  content:
    '안녕하세요! 📚 영어 단어 퀴즈 챗봇입니다.\n\n어떤 주제나 난이도로 영어 단어를 공부해 보고 싶으신가요?\n아래 추천 버튼에서 주제와 난이도를 순서대로 선택하시거나, 원하시는 조건을 입력창에 직접 말씀해 주세요!',
};

const TOPICS = [
  '일상 회화',
  '비즈니스 영어',
  '공항/여행 영어',
  '토익/수능 필수 단어',
];

const LEVELS = ['초급', '중급', '고급'];

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

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
      setSelectedTopic(null);
    }
  };

  // 1단계: 주제 선택 핸들러
  const handleSelectTopic = (topic: string) => {
    setSelectedTopic(topic);
  };

  // 2단계: 난이도 선택 및 메시지 전송 핸들러
  const handleSelectLevel = (level: string) => {
    if (!selectedTopic) return;
    const promptMessage = `주제: ${selectedTopic}\n난이도: ${level}\n위 조건에 맞는 영어 단어 퀴즈를 시작해줘.`;
    setSelectedTopic(null); // 전송 후 주제 선택 초기화
    handleSend(promptMessage);
  };

  // 주제 선택 취소 (다시 주제 선택으로 돌아가기)
  const handleCancelTopic = () => {
    setSelectedTopic(null);
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

      const assistantMsgId = `assistant-${Date.now()}`;
      let hasReceivedChunk = false;

      await sendChatMessageStream(payload, (accumulatedText) => {
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: 'assistant',
              content: accumulatedText,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
            )
          );
        }
      });
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

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
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

      {/* 추천 버튼 (1단계: 주제 선택 / 2단계: 난이도 선택) */}
      <div className="quick-topics">
        {!selectedTopic ? (
          <>
            <span className="quick-topics-label">1단계 주제 선택:</span>
            {TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                className="topic-chip"
                disabled={isLoading}
                onClick={() => handleSelectTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </>
        ) : (
          <>
            <span className="quick-topics-label">
              2단계 난이도 선택: <strong className="selected-topic-name">[{selectedTopic}]</strong>
            </span>
            <button
              type="button"
              className="topic-chip back-chip"
              disabled={isLoading}
              onClick={handleCancelTopic}
              title="다른 주제 다시 선택하기"
            >
              ← 주제 변경
            </button>
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className="topic-chip level-chip"
                disabled={isLoading}
                onClick={() => handleSelectLevel(level)}
              >
                {level}
              </button>
            ))}
          </>
        )}
      </div>

      {/* 입력 영역 (직접 입력 기능 유지) */}
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
            placeholder="주제(예: 여행, 비즈니스)나 난이도, 또는 퀴즈의 정답을 직접 입력하세요..."
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
