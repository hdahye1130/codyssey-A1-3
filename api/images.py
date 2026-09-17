"""Independent image lookup endpoint for MOIRÉ Discover cards."""
import json
import os
import re
import unicodedata
from difflib import SequenceMatcher
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

MAX_RESPONSE_BYTES = 2_000_000
TIMEOUT_SECONDS = 7


def fetch_json(url, headers=None):
    request_headers = {'Accept': 'application/json', 'User-Agent': 'MOIRE/1.0'}
    request_headers.update(headers or {})
    request = Request(url, headers=request_headers)
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError('Image provider response too large')
        return json.loads(payload.decode('utf-8'))


def first_dict(values):
    return next((value for value in values if isinstance(value, dict)), None)


def https_url(value):
    return value.replace('http://', 'https://', 1) if isinstance(value, str) else ''


def fetch_watch_image(title, creator=''):
    api_key = os.getenv('TMDB_API_KEY', '').strip()
    if not api_key:
        return None
    item = None
    queries = dict.fromkeys([title, ' '.join(part for part in (title, creator) if part).strip()])
    for query in queries:
        params = urlencode({
            'api_key': api_key,
            'query': query,
            'include_adult': 'false',
            'language': 'ko-KR',
            'page': 1,
        })
        data = fetch_json(f'https://api.themoviedb.org/3/search/multi?{params}')
        results = [result for result in data.get('results', []) if isinstance(result, dict) and result.get('media_type') in ('movie', 'tv') and result.get('poster_path')]
        item = first_dict(results)
        if item:
            break
    if not item:
        return None
    return {
        'image_url': f"https://image.tmdb.org/t/p/w500{item['poster_path']}",
        'source_url': f"https://www.themoviedb.org/{item['media_type']}/{item.get('id')}",
        'credit': 'Image from TMDB',
    }


def match_score(requested, candidate, *, is_title=True):
    def normalize(value):
        if not isinstance(value, str):
            return ''
        value = unicodedata.normalize('NFKD', value).casefold()
        value = ''.join(char for char in value if not unicodedata.combining(char))
        value = unicodedata.normalize('NFC', value)
        value = ' '.join(''.join(char if char.isalnum() else ' ' for char in value).split())
        if is_title:
            # Strip only known trailing edition labels; preserve meaningful subtitles.
            suffix = r'\s+(?:deluxe(?: edition)?|(?:\d{4} )?remaster(?:ed)?(?: \d{4})?|single|(?:\d+(?:st|nd|rd|th) )?anniversary edition)$'
            while True:
                base = re.sub(suffix, '', value)
                if base == value:
                    break
                value = base
        return value

    left, right = normalize(requested), normalize(candidate)
    if not left or not right:
        return 0.0
    if left == right or left.replace(' ', '') == right.replace(' ', ''):
        return 1.0
    # Keep sequel numbers significant after removing known edition labels.
    if [c for c in left if c.isdigit()] != [c for c in right if c.isdigit()]:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def fetch_listen_image(title, creator='', image_search_title='', image_search_creator=''):
    title = image_search_title.strip() or title
    creator = image_search_creator.strip() or creator
    title_creator = ' '.join(part for part in (title, creator) if part).strip()
    searches = [(title_creator, 'KR'), (title_creator, 'US'), (title, 'KR'), (title, 'US')]
    item = None
    seen = set()
    for query, country in searches:
        if not query or (query, country) in seen:
            continue
        seen.add((query, country))
        candidates = []
        for entity in ('song', 'album'):
            params = urlencode({'term': query, 'country': country, 'media': 'music', 'entity': entity, 'limit': 25})
            data = fetch_json(f'https://itunes.apple.com/search?{params}')
            for result in data.get('results', []):
                if not isinstance(result, dict) or not result.get('artworkUrl100'):
                    continue
                # A song must match its track title, not just its enclosing album.
                name = result.get('trackName') if entity == 'song' else result.get('collectionName')
                title_score = match_score(title, name)
                artist_score = match_score(creator, result.get('artistName'), is_title=False) if creator else 1.0
                if title_score >= 0.92 and artist_score >= 0.92:
                    candidates.append(((title_score, artist_score), result))
        if candidates:
            item = max(candidates, key=lambda candidate: candidate[0])[1]
            break
    if not item:
        return None
    artwork = item['artworkUrl100'].replace('100x100', '600x600').replace('http://', 'https://', 1)
    return {
        'image_url': artwork,
        'source_url': https_url(item.get('trackViewUrl') or item.get('collectionViewUrl') or item.get('artistViewUrl')),
        'credit': 'View on Apple Music',
    }


def fetch_read_image(title, creator='', image_search_title='', image_search_creator=''):
    search_title = image_search_title.strip() or title
    search_creator = image_search_creator.strip() or creator
    searches = [
        {'title': search_title, 'author': search_creator},
        {'title': search_title},
        {'title': title, 'author': creator},
        {'title': title},
    ]
    seen = set()
    match = None
    for search in searches:
        params_data = {key: value for key, value in search.items() if value}
        signature = tuple(sorted(params_data.items()))
        if not params_data.get('title') or signature in seen:
            continue
        seen.add(signature)
        params = urlencode({**params_data, 'fields': 'key,cover_i,title,author_name', 'limit': 25})
        data = fetch_json(f'https://openlibrary.org/search.json?{params}')
        candidates = []
        for item in data.get('docs', []):
            if not isinstance(item, dict) or not item.get('cover_i'):
                continue
            work_key = item.get('key')
            if not isinstance(work_key, str) or not work_key.startswith('/works/'):
                continue
            title_score = match_score(params_data['title'], item.get('title'))
            authors = item.get('author_name', [])
            if not isinstance(authors, list):
                authors = []
            author_score = max((match_score(search_creator, author, is_title=False) for author in authors), default=0.0) if search_creator else 1.0
            if title_score >= 0.92 and author_score >= 0.92:
                candidates.append(((author_score, title_score), item))
        if candidates:
            match = max(candidates, key=lambda candidate: candidate[0])[1]
            break
    if not match:
        return None
    return {
        'image_url': f"https://covers.openlibrary.org/b/id/{match['cover_i']}-L.jpg",
        'source_url': f"https://openlibrary.org{match['key']}",
        'credit': 'View on Open Library',
    }


def fetch_go_image(query):
    api_key = os.getenv('PEXELS_API_KEY', '').strip()
    if not api_key:
        return None
    params = urlencode({'query': query, 'orientation': 'landscape', 'locale': 'ko-KR', 'per_page': 1})
    data = fetch_json(
        f'https://api.pexels.com/v1/search?{params}',
        headers={'Authorization': api_key},
    )
    item = first_dict(data.get('photos', []))
    if not item or not isinstance(item.get('src'), dict):
        return None
    image_url = item['src'].get('landscape') or item['src'].get('large')
    if not image_url:
        return None
    photographer = item.get('photographer', 'Pexels')
    return {
        'image_url': image_url,
        'source_url': item.get('url', 'https://www.pexels.com'),
        'credit': f'Photo by {photographer} on Pexels',
    }


IMAGE_FETCHERS = {
    'watch': lambda values: fetch_watch_image(values['title'], values['creator']),
    'listen': lambda values: fetch_listen_image(values['title'], values['creator'], values.get('image_search_title', ''), values.get('image_search_creator', '')),
    'read': lambda values: fetch_read_image(values['title'], values['creator'], values.get('image_search_title', ''), values.get('image_search_creator', '')),
    'go': lambda values: fetch_go_image(values['search_query'] or values['title']),
}


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        card_type = ''
        try:
            params = parse_qs(urlparse(self.path).query)
            card_type = params.get('type', [''])[0].lower()
            values = {
                key: params.get(key, [''])[0].strip()[:160]
                for key in ('title', 'creator', 'search_query', 'image_search_title', 'image_search_creator')
            }
            if card_type not in IMAGE_FETCHERS or not values['title']:
                self.send_json(400, {'image_url': None})
                return
            if card_type == 'watch' and not os.getenv('TMDB_API_KEY', '').strip():
                self.send_json(200, {'image_url': None, 'reason': 'not-configured'})
                return
            if card_type == 'go' and not os.getenv('PEXELS_API_KEY', '').strip():
                self.send_json(200, {'image_url': None, 'reason': 'not-configured'})
                return
            result = IMAGE_FETCHERS[card_type](values)
            self.send_json(200, result or {'image_url': None, 'reason': 'no-results'})
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            print(f'MOIRÉ image lookup failed: provider={card_type or "unknown"} type={type(error).__name__}')
            self.send_json(200, {'image_url': None, 'reason': 'lookup-failed'})
        except Exception as error:
            print(f'MOIRÉ image lookup failed: provider={card_type or "unknown"} type={type(error).__name__}')
            self.send_json(200, {'image_url': None, 'reason': 'lookup-failed'})
