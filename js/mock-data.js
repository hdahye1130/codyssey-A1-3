/* Static UI preview data. Loaded only by the page; never used as an API error fallback. */
window.createMoirePreview = function (things) {
    const names = things.slice(0, 2).map(thing => thing.name);
    const connection = `${names[0]}와 ${names[1]}처럼 서로 다른 취향을 나란히 놓으면, 고요한 장면 속에서 작은 변화를 발견하는 흐름이 보입니다. 입력한 취향을 엮어 화면을 살펴보기 위한 예시 문장입니다.`;
    const recommendation = (title, creator, reason, whyMatch, country = '', searchQuery = '') => ({
        title, creator, country, reason, why_match: whyMatch, search_query: searchQuery
    });
    return {
        pattern: {
            keywords: ['여백', '잔잔한 대비', '느린 발견', '겹치는 장면'],
            summary: '익숙한 장면 사이에서 새로운 결을 발견하는 취향.',
            connection,
            mood: '조용하고 부드러운 공기',
            detail: '빛과 그림자가 겹치는 작은 순간',
            feeling: '천천히 머물며 발견하는 즐거움',
            one_line: '서로 다른 것들이 겹칠 때 생기는 은은한 아름다움에 끌립니다.',
            image_prompt: 'Soft pastel moire waves in cream, lavender, pale blue and blush pink.'
        },
        discover: {
            watch: recommendation('리틀 포레스트', '임순례', '계절의 흐름과 일상의 리듬을 차분하게 담은 영화예요.', '여백과 느린 발견이라는 예시 패턴을 화면 밖의 이야기로 확장해요.'),
            listen: recommendation('Vespertine', 'Björk', '작은 소리들이 층을 이루는 앨범이에요.', '겹치는 장면의 감각을 소리의 질감으로 옮겨볼 수 있어요.'),
            read: recommendation('모모', '미하엘 엔데', '시간과 귀 기울임을 다시 생각하게 하는 책이에요.', '천천히 머무는 즐거움이라는 결을 이야기로 이어줘요.'),
            go: recommendation('교토 철학의 길', '', '물길을 따라 천천히 걸으며 풍경을 볼 수 있는 장소예요.', '작은 변화에 시선을 두는 예시 패턴을 공간으로 넓혀줘요.', '일본', 'Kyoto Philosopher’s Path')
        }
    };
};
