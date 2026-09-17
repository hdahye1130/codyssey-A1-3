const $ = (selector) => document.querySelector(selector);
const storageKey = 'moire.things.v1';
const nameInput = $('#thing-name');
const reasonInput = $('#thing-reason');
const findButton = $('#find-pattern-button');
const categories = [...document.querySelectorAll('.category-button')];
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isLiveServer = isLocalHost && /^55\d\d$/.test(window.location.port);
const useLocalPreview = isLiveServer;
let selectedCategory = '';
let things = loadThings();
let currentResult = null;
let loadingTimer;

function loadThings() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return Array.isArray(saved) ? saved.filter(item => item && typeof item.name === 'string').map(item => ({
            name: item.name.slice(0, 120), category: String(item.category || '').slice(0, 40), reason: String(item.reason || '').slice(0, 500)
        })) : [];
    } catch { return []; }
}
function saveThings() { try { localStorage.setItem(storageKey, JSON.stringify(things)); } catch {} }
function scrollToSection(id, behavior = 'smooth') {
    const section = document.getElementById(id);
    if (!section) return;
    const navbarHeight = document.querySelector('.navbar').getBoundingClientRect().height;
    const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - navbarHeight);
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : behavior });
}
$('#start-button').addEventListener('click', () => scrollToSection('my-things'));
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const id = link.getAttribute('href').slice(1);
    if (!document.getElementById(id)) return;
    event.preventDefault();
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
    scrollToSection(id);
}));
window.addEventListener('popstate', () => {
    const id = window.location.hash.slice(1) || 'home';
    scrollToSection(id, 'instant');
});
window.addEventListener('load', () => {
    if (window.location.hash) scrollToSection(window.location.hash.slice(1), 'instant');
});

categories.forEach(button => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category === selectedCategory ? '' : button.dataset.category;
    categories.forEach(item => { item.classList.toggle('selected', item.dataset.category === selectedCategory); item.setAttribute('aria-pressed', String(item.dataset.category === selectedCategory)); });
}));
$('#inspiration-toggle').addEventListener('click', () => {
    const expanded = $('#inspiration-box').classList.toggle('hidden') === false;
    $('#inspiration-toggle').setAttribute('aria-expanded', String(expanded));
});
function showFormMessage(message) { $('#form-message').textContent = message; }
function hidePreviousResult() {
    currentResult = null;
    $('#pattern').classList.remove('is-loading');
    $('#pattern-result').classList.add('hidden');
    $('#discover-list').classList.add('hidden');
    $('#discover-placeholder').classList.remove('hidden');
    $('#discover-preview-notice').classList.add('hidden');
}
function addThing() {
    const name = nameInput.value.trim();
    if (!name) { showFormMessage('좋아하는 것을 하나 입력해주세요.'); nameInput.focus(); return; }
    things.push({ name: name.slice(0, 120), category: selectedCategory, reason: reasonInput.value.trim().slice(0, 500) });
    if (currentResult) {
        hidePreviousResult();
        $('#analysis-state').textContent = '취향 목록이 바뀌었어요. 다시 패턴을 찾아주세요.';
        $('#analysis-state').classList.remove('hidden');
    }
    nameInput.value = ''; reasonInput.value = ''; selectedCategory = '';
    categories.forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
    showFormMessage(''); saveThings(); renderThings(); nameInput.focus();
}
$('#add-thing-button').addEventListener('click', addThing);
nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') addThing(); });
function renderThings() {
    const list = $('#things-list'); list.replaceChildren();
    things.forEach((thing, index) => {
        const card = document.createElement('article'); card.className = 'thing-card';
        const remove = document.createElement('button'); remove.className = 'remove-button'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `${thing.name} 삭제`);
        remove.addEventListener('click', () => { things.splice(index, 1); saveThings(); renderThings(); hidePreviousResult(); $('#analysis-state').textContent = '취향 목록이 바뀌었어요. 다시 패턴을 찾아주세요.'; $('#analysis-state').classList.remove('hidden'); });
        const category = document.createElement('span'); category.className = 'thing-card-category'; category.textContent = thing.category || '자유';
        const title = document.createElement('h4'); title.textContent = thing.name;
        card.append(remove, category, title);
        if (thing.reason) { const reason = document.createElement('p'); reason.className = 'thing-card-reason'; reason.textContent = thing.reason; card.append(reason); }
        list.append(card);
    });
    $('#things-count').textContent = `${things.length} things collected.`;
    findButton.disabled = things.length < 3;
}
const loadingMessages = ['취향의 조각들을 겹쳐보는 중…', '서로 닮은 결을 찾고 있어요…', '새로운 패턴이 나타나고 있어요…'];
function setText(id, value) { $(id).textContent = typeof value === 'string' ? value : ''; }

async function fetchImageFromApi(type, item) {
    const params = new URLSearchParams({
        type,
        title: item.title || '',
        creator: item.creator || '',
        search_query: item.search_query || ''
    });
    if (type === 'listen' || type === 'read') {
        for (const key of ['image_search_title', 'image_search_creator']) {
            if (item[key]) params.set(key, item[key]);
        }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`/api/images?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Image request returned ${response.status}`);
        const data = await response.json();
        if (!data || typeof data.image_url !== 'string' || !data.image_url.startsWith('https://')) {
            console.info('MOIRÉ image unavailable', { type, reason: data?.reason || 'no-image' });
            return null;
        }
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

function fetchWatchImage(item) { return fetchImageFromApi('watch', item); }
function fetchListenImage(item) { return fetchImageFromApi('listen', item); }
function fetchReadImage(item) { return fetchImageFromApi('read', item); }
function fetchGoImage(item) { return fetchImageFromApi('go', item); }

const imageFetchers = {
    watch: fetchWatchImage,
    listen: fetchListenImage,
    read: fetchReadImage,
    go: fetchGoImage
};

async function loadDiscoverImage(type, item, visual) {
    try {
        const imageData = await imageFetchers[type](item);
        if (!imageData || !visual.isConnected) return;
        const image = new Image();
        image.alt = `${item.title} 이미지`;
        image.loading = 'eager';
        image.decoding = 'async';
        image.addEventListener('load', () => {
            if (!visual.isConnected) return;
            visual.replaceChildren(image);
            visual.classList.add('has-image');
            if (typeof imageData.source_url === 'string' && imageData.source_url.startsWith('https://') && imageData.credit) {
                const credit = document.createElement('a');
                credit.className = 'image-credit';
                credit.href = imageData.source_url;
                credit.target = '_blank';
                credit.rel = 'noopener noreferrer';
                credit.textContent = imageData.credit;
                visual.append(credit);
            }
        }, { once: true });
        image.addEventListener('error', () => {
            console.info('MOIRÉ image unavailable', { type, reason: 'image-load-failed' });
        }, { once: true });
        image.src = imageData.image_url;
    } catch (error) {
        console.info('MOIRÉ image unavailable', {
            type,
            reason: error.name === 'AbortError' ? 'timeout' : 'lookup-failed'
        });
    }
}

function renderResult(data, isPreview = false) {
    const pattern = data.pattern; const discover = data.discover;
    if (!pattern || !discover || !Array.isArray(pattern.keywords)) throw new Error('Invalid result');
    const keywords = $('#pattern-keywords'); keywords.replaceChildren();
    pattern.keywords.slice(0, 5).forEach(word => { const chip = document.createElement('span'); chip.textContent = word; keywords.append(chip); });
    ['summary', 'connection', 'mood', 'detail', 'feeling', 'one_line'].forEach(key => setText(`#pattern-${key.replace('_', '-')}`, pattern[key]));
    const list = $('#discover-list'); list.replaceChildren();
    const labels = { watch: 'WATCH', listen: 'LISTEN', read: 'READ', go: 'GO' };
    Object.entries(labels).forEach(([key, label]) => {
        const item = discover[key]; if (!item || !item.title) return;
        const card = document.createElement('article'); card.className = `discover-card discover-${key}`;
        const visual = document.createElement('div'); visual.className = 'discover-visual'; visual.setAttribute('role', 'img'); visual.setAttribute('aria-label', `${label} 모아레 배경`); visual.textContent = label;
        const body = document.createElement('div'); body.className = 'discover-card-body';
        const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = label;
        const title = document.createElement('h3'); title.textContent = item.title;
        const creator = document.createElement('p'); creator.className = 'discover-creator'; creator.textContent = item.creator || item.country || '';
        const reason = document.createElement('p'); reason.textContent = item.reason || '';
        const match = document.createElement('p'); match.className = 'why-match'; match.textContent = item.why_match || '';
        body.append(eyebrow, title, creator, reason, match); card.append(visual, body); list.append(card);
        if (!isPreview) loadDiscoverImage(key, item, visual);
    });
    if (list.children.length !== 4) throw new Error('Incomplete result');
    $('#preview-notice').classList.toggle('hidden', !isPreview);
    $('#discover-preview-notice').classList.toggle('hidden', !isPreview);
    $('#pattern').classList.remove('is-loading');
    $('#analysis-state').classList.add('hidden'); $('#pattern-result').classList.remove('hidden');
    $('#discover-placeholder').classList.add('hidden'); list.classList.remove('hidden');
    currentResult = data;
}
findButton.addEventListener('click', async () => {
    if (things.length < 3) { showFormMessage('좋아하는 것을 3개 이상 모아주세요.'); return; }
    findButton.disabled = true; hidePreviousResult(); $('#analysis-state').classList.remove('hidden'); $('#pattern').classList.add('is-loading');
    scrollToSection('pattern'); let step = 0; $('#analysis-state').textContent = loadingMessages[step];
    loadingTimer = setInterval(() => { step = (step + 1) % loadingMessages.length; $('#analysis-state').textContent = loadingMessages[step]; }, 2800);
    const controller = new AbortController();
    let timeout;
    try {
        if (useLocalPreview) {
            await new Promise(resolve => setTimeout(resolve, 3300));
            renderResult(window.createMoirePreview(things), true);
            return;
        }
        timeout = setTimeout(() => controller.abort(), 25000);
        const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ things }), signal: controller.signal });
        if (!response.ok) {
            const requestError = new Error('Analyze request failed');
            requestError.status = response.status;
            throw requestError;
        }
        renderResult(await response.json());
    } catch (error) {
        $('#pattern').classList.remove('is-loading');
        console.error('MOIRÉ analyze failed', {
            type: error.name || 'Error',
            status: error.status || null,
            message: error.name === 'AbortError' ? 'Request timed out' : error.message
        });
        $('#analysis-state').textContent = error.name === 'AbortError' ? '응답이 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.' : '지금은 패턴을 찾지 못했어요. 잠시 후 다시 시도해주세요.';
    } finally { clearInterval(loadingTimer); clearTimeout(timeout); findButton.disabled = things.length < 3; }
});
renderThings();
