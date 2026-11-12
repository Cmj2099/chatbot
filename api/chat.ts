import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

/**
 * 영어 단어 퀴즈 챗봇 시스템 프롬프트
 * 프롬프트 수정이 필요할 경우 이 상수를 자유롭게 변경할 수 있습니다.
 */
export const SYSTEM_PROMPT = `당신은 친절하고 효과적인 '영어 단어 퀴즈 챗봇'입니다.
다음 규칙을 엄격히 준수하여 사용자와 대화하세요:

1. [기본 어조]
   - 모든 설명과 피드백은 한국어로 간결하고 친절하게 작성하세요.

2. [주제 및 난이도 확인]
   - 사용자가 학습하고 싶은 구체적인 주제(예: 비즈니스, 해외여행, 일상 대화 등)나 난이도(초급, 중급, 고급 등)를 말하지 않았다면, 먼저 단어를 알려주지 말고 원하는 주제나 난이도를 먼저 물어보세요.

3. [단어 제시 규칙]
   - 사용자가 주제나 난이도를 입력하면, 그에 맞는 유용한 영어 단어를 한 번에 최대 3개까지만 알려주세요.
   - 각 단어는 아래 양식을 준수하여 깔끔하게 제공하세요:
     1) 영어 단어 (품사)
     - 한국어 뜻
     - 짧은 영어 예문 (한국어 해석)

4. [복습 퀴즈 출제]
   - 단어 소개 직후, 마지막에 방금 소개한 단어 중 하나를 활용한 짧은 복습 퀴즈를 '정확히 1개만' 출제하세요.
   - 퀴즈는 객관식(보기 3~4개) 또는 빈칸 채우기 형태여야 합니다.

5. [정답 확인 및 다음 단계]
   - 사용자가 퀴즈에 답변하면 정답 여부를 채점하고 따뜻한 피드백을 제공하세요.
   - 피드백 후 "추가 단어를 더 학습할지" 혹은 "새로운 주제를 선택할지" 간결하게 물어보세요.`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequestBody {
  messages?: ChatMessage[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error:
        '서버 환경 변수 OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 유효한 OpenAI API Key를 입력한 후 서버를 재시작해 주세요.',
    });
  }

  try {
    const { messages } = (req.body || {}) as ChatRequestBody;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: '대화 메시지(messages) 배열이 필요합니다.',
      });
    }

    const openai = new OpenAI({
      apiKey,
    });

    // OpenAI Responses API 호출 (gpt-6-luna 모델, reasoning.effort: none)
    const response = await openai.responses.create({
      model: 'gpt-6-luna',
      reasoning: {
        effort: 'none',
      },
      instructions: SYSTEM_PROMPT,
      input: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // 텍스트 추출: SDK 편리 속성 output_text 또는 output 배열 구조 탐색
    let replyText = response.output_text?.trim();

    if (!replyText && Array.isArray(response.output)) {
      replyText = response.output
        .map((item: any) => {
          if (item?.type === 'message' && Array.isArray(item.content)) {
            return item.content
              .filter((c: any) => c?.type === 'output_text' || typeof c?.text === 'string')
              .map((c: any) => c.text || '')
              .join('');
          }
          return '';
        })
        .join('\n')
        .trim();
    }

    if (!replyText) {
      replyText = '답변을 생성하지 못했습니다. 다시 시도해 주세요.';
    }

    return res.status(200).json({
      message: {
        role: 'assistant',
        content: replyText,
      },
    });
  } catch (error: any) {
    console.error('[OpenAI Responses API Error]:', error);
    const message = error?.message || 'OpenAI API 호출 중 오류가 발생했습니다.';
    return res.status(error?.status || 500).json({
      error: message,
    });
  }
}

