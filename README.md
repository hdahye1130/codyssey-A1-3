# MOIRÉ

흩어진 취향들 사이의 연결을 발견하는 AI 취향 아카이브

## 서비스 흐름

HOME → MY THINGS → PATTERN → DISCOVER

MY THINGS에서 좋아하는 대상과 카테고리, 좋아하는 이유를 3개 이상 입력하면 Gemini가 취향 사이의 공통 패턴을 분석합니다. 취향 목록은 브라우저 localStorage에 저장됩니다.

PATTERN에서는 키워드, 요약, 취향 사이의 연결, 분위기, 디테일, 감정과 한 줄 설명을 보여줍니다. DISCOVER에서는 WATCH / LISTEN / READ / GO 네 분야의 새로운 취향을 추천하고 추천 이유와 기존 취향과의 연결을 설명합니다. GO에는 국가 정보도 포함됩니다.

DISCOVER의 모아레 visual과 분야별 텍스트는 서로 다른 취향이 겹쳐 새로운 결을 만든다는 서비스 컨셉을 표현하는 의도된 그래픽입니다.

## 기술 스택과 구조

- 프론트엔드: HTML / CSS / Vanilla JavaScript
- 백엔드: Python / Vercel Serverless Function / Gemini API
- `index.html`: HOME, MY THINGS, PATTERN, DISCOVER 화면
- `css/style.css`: 레이아웃과 모아레 그래픽
- `js/main.js`: 입력, localStorage, 내비게이션, 분석 요청과 결과 표시
- `js/mock-data.js`: 로컬 Live Server용 예시 데이터
- `api/analyze.py`: 입력 검증, Gemini 분석, JSON 응답과 서버 오류 처리
- `requirements.txt`: Python 의존성

프론트엔드는 입력한 취향을 `POST /api/analyze`로 전달합니다. 서버는 입력을 검증한 뒤 Gemini API에 공통 패턴과 네 분야 추천을 요청하고, 정해진 JSON schema의 결과를 반환합니다. 프론트엔드는 결과를 PATTERN과 DISCOVER에 표시합니다. 분석에 실패하면 기존의 안내 메시지를 표시합니다.

## 환경변수

`.env.example`을 참고해 로컬에서는 `.env.local`, 배포에서는 Vercel 프로젝트의 Environment Variables에 설정합니다.

- `GEMINI_API_KEY`: 서버에서 Gemini API를 호출하는 데 필요한 키입니다.
- `GEMINI_MODEL`: 환경변수가 없으면 `gemini-3.5-flash-lite`를 사용하며, 환경변수로 지정한 모델은 그대로 사용합니다. Gemini 호출에서 `429` 또는 `RESOURCE_EXHAUSTED` 오류가 발생하면 `gemini-3.1-flash-lite`로 딱 한 번 재시도합니다. SDK 자체 재시도는 비활성화하며, fallback도 실패하거나 다른 오류가 발생하면 기존 오류 안내를 표시합니다.
- `MOIRE_MOCK_MODE`: 로컬 백엔드 예시 응답을 사용할 때만 `1`로 설정합니다. 실제 Gemini 분석을 사용하는 배포 환경에서는 `0`으로 설정하거나 생략합니다.

API 키는 프론트엔드 코드에 넣거나 GitHub에 커밋하지 않습니다. `.env.local` 등 실제 환경변수 파일은 `.gitignore`로 제외하며, 값이 비어 있는 `.env.example`만 공유합니다.

## 로컬 실행과 배포

VS Code Live Server로 `http://127.0.0.1:5500` 또는 `http://localhost:5500`에서 열면 mock preview로 화면 흐름을 확인할 수 있습니다. 로컬 5500–5599 포트에서 자동 적용되며, 예시 분석·추천은 실제 AI 결과가 아닙니다.

로컬에서 실제 API를 사용하려면 `pip install -r requirements.txt`로 의존성을 설치하고, `.env.local`에 Gemini 환경변수를 설정한 뒤 Vercel CLI의 `vercel dev`를 실행합니다. `localhost:3000`에서는 `/api/analyze`를 호출합니다. 정적 파일만 여는 방식으로는 Python API가 실행되지 않습니다.

Vercel에 배포한 서비스는 환경변수의 `GEMINI_API_KEY`를 사용해 실제 Gemini API를 호출합니다. 환경변수를 설정하고 `MOIRE_MOCK_MODE`가 `1`이 아닌 상태로 배포하세요.
기존 Vercel 환경변수에 `GEMINI_MODEL`이 지정되어 있다면 `gemini-3.5-flash-lite`로 변경하거나 삭제한 뒤 다시 배포해야 새 기본 모델을 사용합니다.
