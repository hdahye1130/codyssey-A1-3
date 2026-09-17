"""Independent image lookup endpoint for MOIRÉ Discover cards."""
import json
import os
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


def fetch_listen_image(title, creator=''):
    title_creator = ' '.join(part for part in (title, creator) if part).strip()
    searches = [
        (title_creator, 'KR'),
        (title, 'KR'),
        (title_creator, 'US'),
        (title, 'US'),
    ]
    item = None
    seen = set()
    for query, country in searches:
        search = (query, country)
        if not query or search in seen:
            continue
        seen.add(search)
        params = urlencode({'term': query, 'country': country, 'media': 'music', 'entity': 'album', 'limit': 5})
        data = fetch_json(f'https://itunes.apple.com/search?{params}')
        item = first_dict([result for result in data.get('results', []) if isinstance(result, dict) and result.get('artworkUrl100')])
        if item:
            break
    if not item:
        return None
    artwork = item['artworkUrl100'].replace('100x100', '600x600').replace('http://', 'https://', 1)
    return {
        'image_url': artwork,
        'source_url': https_url(item.get('collectionViewUrl') or item.get('artistViewUrl')),
        'credit': 'View on Apple Music',
    }


def fetch_read_image(title, creator=''):
    title_creator = ' '.join(part for part in (title, creator) if part).strip()
    searches = [
        ' '.join(part for part in (f'intitle:"{title}"', f'inauthor:"{creator}"' if creator else '') if part),
        f'intitle:"{title}"',
        title_creator,
        title,
    ]
    match = None
    seen = set()
    for query in searches:
        if not query or query in seen:
            continue
        seen.add(query)
        params = urlencode({'q': query, 'printType': 'books', 'maxResults': 5})
        data = fetch_json(f'https://www.googleapis.com/books/v1/volumes?{params}')
        for item in data.get('items', []):
            if not isinstance(item, dict):
                continue
            volume = item.get('volumeInfo')
            if not isinstance(volume, dict) or not isinstance(volume.get('imageLinks'), dict):
                continue
            image_url = volume['imageLinks'].get('thumbnail') or volume['imageLinks'].get('smallThumbnail')
            if image_url:
                match = (item, volume, image_url)
                break
        if match:
            break
    if not match:
        return None
    item, volume, image_url = match
    return {
        'image_url': image_url.replace('http://', 'https://', 1),
        'source_url': https_url(volume.get('infoLink')) or f"https://books.google.com/books?id={item.get('id', '')}",
        'credit': 'View on Google Books',
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
    'listen': lambda values: fetch_listen_image(values['title'], values['creator']),
    'read': lambda values: fetch_read_image(values['title'], values['creator']),
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
                for key in ('title', 'creator', 'search_query')
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
