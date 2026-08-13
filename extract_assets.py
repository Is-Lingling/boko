import re
from pathlib import Path
files = [
    {'html': 'index.html', 'css': Path('css/index.css'), 'js': Path('js/index.js')},
    {'html': 'article.html', 'css': Path('css/article.css'), 'js': Path('js/article.js')},
    {'html': 'admin/login.html', 'css': Path('admin/css/login.css'), 'js': Path('admin/js/login.js')}
]
for file in files:
    html_path = Path(file['html'])
    content = html_path.read_text(encoding='utf8')
    style = re.search(r'<style[^>]*>([\s\S]*?)</style>', content)
    script = re.search(r'<script[^>]*>([\s\S]*?)</script>', content)
    if style:
        file['css'].parent.mkdir(parents=True, exist_ok=True)
        file['css'].write_text(style.group(1), encoding='utf8')
        print('wrote', file['css'])
    if script:
        file['js'].parent.mkdir(parents=True, exist_ok=True)
        file['js'].write_text(script.group(1), encoding='utf8')
        print('wrote', file['js'])
