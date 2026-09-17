# MOIRÉ

흩어진 취향들 사이의 연결을 발견하는 AI 취향 아카이브. 순수 HTML/CSS/JavaScript와 Vercel Python Function으로 구성했습니다.

## 개발 및 배포

1. `pip install -r requirements.txt`
2. [Vercel CLI](https://vercel.com/docs/cli)를 설치하고 프로젝트 루트에서 `vercel dev` 실행
3. 로컬 실제 API 테스트는 `.env.local`의 `GEMINI_API_KEY=` 뒤에 본인의 키를 입력하세요. WATCH 이미지에는 `TMDB_API_KEY`, GO 이미지에는 `PEXELS_API_KEY`가 필요합니다. 키를 HTML, JavaScript, Python 소스에 직접 넣거나 Git에 커밋하면 안 됩니다. 필요하면 `GEMINI_MODEL`을 지정할 수 있으며 기본값은 `gemini-2.5-flash`입니다.
4. VS Code Live Server의 `http://127.0.0.1:5500` 또는 `http://localhost:5500`에서 페이지를 열면 프런트엔드 예시 결과로 전체 UI를 테스트할 수 있습니다. 5500–5599 포트에서만 자동 적용됩니다. `localhost:3000`의 Vercel 개발 서버는 `/api/analyze`를 호출합니다.
5. Vercel 개발 서버에서도 API 키 없이 테스트하려면 로컬 환경에서 `MOIRE_MOCK_MODE=1`을 설정할 수 있습니다. 이 모드의 분석·추천 역시 AI 결과가 아닙니다. 실제 배포 환경에서는 이 값을 설정하지 마세요.

정적 HTML 파일만 열면 입력과 목록은 작동하지만 `/api/analyze`와 `/api/images` 요청은 Vercel 개발 서버 또는 배포 환경이 필요합니다. DISCOVER 텍스트가 먼저 렌더링된 뒤 WATCH는 TMDb, LISTEN은 iTunes Search, READ는 Google Books, GO는 Pexels에서 이미지를 독립적으로 조회합니다. iTunes Search와 Google Books의 공개 검색에는 별도 키가 필요하지 않습니다. 키가 없거나 조회가 실패한 카드에는 기존 모아레 fallback visual이 남습니다. AI 응답의 `image_prompt`는 이후 별도 이미지 생성 엔드포인트에 연결할 수 있습니다.

배포 환경에서도 Vercel 프로젝트의 Environment Variables에 `TMDB_API_KEY`와 `PEXELS_API_KEY`를 추가해야 WATCH와 GO 이미지가 표시됩니다. 외부 이미지에는 해당 제공처로 연결되는 작은 출처 링크가 함께 표시됩니다. TMDb 이미지를 사용하는 서비스에는 TMDb의 별도 표시·귀속 정책도 적용되므로 공개 배포 전 [TMDb attribution requirements](https://developer.themoviedb.org/docs/faq)를 확인하세요.

취향 목록은 브라우저 localStorage에 저장됩니다. API 키나 개인 정보는 저장소에 커밋하지 마세요.
