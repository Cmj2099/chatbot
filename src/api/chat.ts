export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 프런트엔드에서 Vercel 서버리스 함수(/api/chat)를 호출하여 답변을 실시간 스트리밍으로 수신합니다.
 * @param messages 이전 대화 목록
 * @param onChunk 새로운 텍스트 청크가 도착할 때마다 호출되며, 지금까지 누적된 전체 답변 텍스트를 인자로 받습니다.
 * @returns 완성된 전체 답변 문자열
 */
export async function sendChatMessageStream(
  messages: ChatMessage[],
  onChunk: (accumulatedText: string) => void,
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    let errorMessage = `요청 실패 (상태 코드: ${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      // JSON 파싱 불가 시 기본 메시지 유지
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('응답 본문(ReadableStream)이 비어 있습니다.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    accumulated += chunk;
    onChunk(accumulated);
  }

  // 남은 바이트 처리
  const finalChunk = decoder.decode();
  if (finalChunk) {
    accumulated += finalChunk;
    onChunk(accumulated);
  }

  if (!accumulated.trim()) {
    throw new Error('서버로부터 유효한 답변을 받지 못했습니다.');
  }

  return accumulated;
}

/**
 * 단일 완성 텍스트가 필요할 경우 사용할 수 있는 헬퍼 함수
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  let result = '';
  await sendChatMessageStream(messages, (accumulated) => {
    result = accumulated;
  });
  return result;
}
