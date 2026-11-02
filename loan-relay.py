#!/usr/bin/env python3
"""Loan relay 0.7. Upload ONLY files recorded after yt-dlp's after_move stage.
No dependency outside Python's standard library. Never deletes local audio.
"""
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.request
import urllib.error

DOCS = Path(__file__).resolve().parent
CONFIG = DOCS / '.loan-relay-config.json'
JOURNAL = DOCS / '.loan-relay-sent.json'
READY = DOCS / 'loan-ready.txt'
MUSIC = DOCS / 'LoanMusic'
MAX_SIZE = 30 * 1024 * 1024

def save(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)

def load(path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))

def validate_config(c):
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', c.get('url', '')):
        raise ValueError('URL attendue : https://IDENTIFIANT.supabase.co (sans chemin).')
    if not c.get('key', '').startswith('sb_publishable_'):
        raise ValueError('Utilise la cle Publishable commencant par sb_publishable_.')
    return c

def request(c, route, payload=None, token=None, binary=False):
    headers = {'apikey': c['key']}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if binary:
        headers.update({'Content-Type': 'audio/mpeg', 'x-upsert': 'true'})
        data = payload
    else:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(c['url'] + route, data=data, headers=headers)
    # Do not forward credentials to redirects.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=120) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as exc:
        # Keep raw responses out of console (could include identifiers).
        raise RuntimeError('Relais refuse (HTTP %s). Verifie connexion, compte et regles SQL.' % exc.code) from None

def login(c):
    return request(c, '/auth/v1/token?grant_type=password',
                   {'email': c['email'], 'password': c['password']})

def configure():
    print('Configuration privee : ne partage pas le fichier de configuration.')
    c = {'url': input('Project URL : ').strip().rstrip('/'),
         'key': input('Publishable key : ').strip(),
         'email': input('Email du compte Authentication : ').strip(),
         'password': getpass.getpass('Mot de passe de ce compte : ')}
    validate_config(c)
    login(c)
    save(CONFIG, c)
    print('Connexion reussie. Configuration enregistree sur cet iPhone.')

def describe(path):
    stat = path.stat()
    if not 0 < stat.st_size <= MAX_SIZE:
        raise ValueError('MP3 vide ou superieur a 30 Mio : ' + path.name)
    raw = path.read_bytes()
    after = path.stat()
    if after.st_size != stat.st_size or after.st_mtime_ns != stat.st_mtime_ns:
        raise ValueError('Fichier encore en modification : ' + path.name)
    # Short UTF-8 filename, ASCII-only transport key. Preserve accents when decoded.
    label = path.stem[:100] + '.mp3'
    label64 = base64.urlsafe_b64encode(label.encode()).decode().rstrip('=')
    name = '%s_%s_%s.mp3' % (int(stat.st_mtime * 1000), hashlib.sha256(raw).hexdigest(), label64)
    return name, raw

def upload_pending():
    c = validate_config(load(CONFIG) or {})
    done = load(JOURNAL, {})
    if not READY.exists():
        print('Aucun MP3 termine en attente. Lance un nouveau telechargement.')
        return
    session = None
    count = 0
    failed = 0
    # after_move emits absolute paths; ignore anything outside LoanMusic.
    for line in dict.fromkeys(READY.read_text(encoding='utf-8').splitlines()):
        path = Path(line).expanduser().resolve()
        if path.parent != MUSIC.resolve() or path.suffix.lower() != '.mp3' or not path.is_file():
            continue
        try:
            stat = path.stat()
            fingerprint = json.dumps([c['url'], c['email'], str(path), stat.st_size, stat.st_mtime_ns])
            if fingerprint in done:
                continue
            name, raw = describe(path)
            if session is None:
                session = login(c)
            uid = session['user']['id']
            print('Envoi prive : ' + path.name, flush=True)
            request(c, '/storage/v1/object/loan-inbox/' + uid + '/' + name,
                    raw, session['access_token'], binary=True)
            done[fingerprint] = True
            save(JOURNAL, done)
            count += 1
        except Exception as error:
            failed += 1
            print('EN ATTENTE : ' + str(error), flush=True)
    print('%s fichier(s) envoye(s). %s envoi(s) a reprendre.' % (count, failed))
    if failed:
        raise RuntimeError('Originaux conserves. Relance cette commande pour reessayer.')

if __name__ == '__main__':
    try:
        if '--configure' in sys.argv:
            configure()
        else:
            upload_pending()
    except KeyboardInterrupt:
        print('\nInterrompu. Originaux conserves.')
        sys.exit(1)
    except Exception as error:
        print('ERREUR : ' + str(error))
        sys.exit(1)
