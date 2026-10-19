"""
Builds src/bing/msOperations.json – every Microsoft Advertising REST v13 operation with
its HTTP method, path and request/response elements – from Microsoft's documentation
(https://github.com/MicrosoftDocs/Advertising, folder advertising/bingads-13).

  git clone --depth 1 https://github.com/MicrosoftDocs/Advertising /tmp/msdocs
  python3 scripts/ms-operations.py /tmp/msdocs/advertising/bingads-13 src/bing/msOperations.json
"""
import glob, re, os, json, sys
root = sys.argv[1]
SERVICES = {'campaign-management-service':'campaign','reporting-service':'reporting','customer-management-service':'customer','customer-billing-service':'billing','ad-insight-service':'adinsight','bulk-service':'bulk'}
def clean(t):
    t = re.sub(r'<br/?>', ' ', t); t = re.sub(r'<[^>]+>', '', t); t = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()
ops = []
for d, svc in SERVICES.items():
    for f in sorted(glob.glob(f'{root}/{d}/*.md')):
        t = open(f, encoding='utf-8').read()
        m = re.search(r'```(GET|POST|PUT|DELETE|PATCH)\s*\nhttps://[a-z.]*?bingads\.microsoft\.com/[A-Za-z]+/v13/([^\s`]+)', t)
        if not m or 'sandbox' in m.group(0): 
            m2 = [x for x in re.finditer(r'```(GET|POST|PUT|DELETE|PATCH)\s*\nhttps://([a-z.]*?)bingads\.microsoft\.com/[A-Za-z]+/v13/([^\s`]+)', t) if 'sandbox' not in x.group(2)]
            if not m2: continue
            method, path = m2[0].group(1), m2[0].group(3)
        else:
            method, path = m.group(1), m.group(2)
        title = re.search(r'^# (\w+) Service Operation', t, re.M)
        name = title.group(1) if title else os.path.basename(f)[:-3]
        desc = re.search(r'^# .*\n+(.+)', t, re.M)
        rest = t[t.find('zone pivot="rest"'):] if 'zone pivot="rest"' in t else t
        def table(section):
            s = re.search(section + r'.*?\n\|Element\|.*?\n\|[-| ]+\|\n((?:\|.*\n)+)', rest, re.S)
            out = []
            if not s: return out
            for row in s.group(1).strip().split('\n'):
                cells = row.strip('|').split('|')
                if len(cells) < 3: continue
                if clean(cells[0]) == 'Element' or set(cells[0].strip()) <= set('-'): break
                el = clean(cells[0]); de = clean(cells[1]); ty = clean(cells[-1])
                out.append({'name': el, 'type': ty, 'optional': bool(re.search(r'\boptional\b|not required|is not required', de, re.I)), 'note': de[:180]})
            return out
        ops.append({'operation': name, 'service': svc, 'method': method, 'path': path, 'summary': clean(desc.group(1))[:220] if desc else '', 'request': table('### <a name="request-body"></a>Request Body Elements'), 'response': [r['name'] for r in table('### <a name="response-body"></a>Response Body Elements')]})
compact = [{
    'op': o['operation'], 'service': o['service'], 'method': o['method'], 'path': o['path'], 'summary': o['summary'],
    'request': [{'name': r['name'], 'type': r['type'], **({'optional': True} if r['optional'] else {}), 'note': r['note']} for r in o['request']],
    'response': o['response'],
} for o in sorted(ops, key=lambda o: (o['service'], o['operation']))]
json.dump(compact, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(ops), 'operations')
from collections import Counter; print(Counter(o['service'] for o in ops))
