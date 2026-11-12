export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatApiResponse {
  message?: {
    role: 'assistant';
    content: string;
  };
  error?: string;
}

/**
 * 프런트엔드에서 Vercel 서버리스 함수(/api/chat)를 호출합니다.
 * 실제 OpenAI API 호출 및 API Key 접근은 서버 측에서 안전하게 처리됩니다.
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  const data: ChatApiResponse = await response.json().catch(() => ({
    error: `서버 응답을 파싱할 수 없습니다. (상태 코드: ${response.status})`,
  }));

  if (!response.ok) {
    throw new Error(data.error || `요청 실패 (상태 코드: ${response.status})`);
  }

  if (!data.message?.content) {
    throw new Error('서버로부터 유효한 답변을 받지 못했습니다.');
  }

  return data.message.content;
}

