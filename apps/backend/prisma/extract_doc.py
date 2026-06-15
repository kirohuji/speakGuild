from pypdf import PdfReader
import json

# Try reading the doc file (it might be a PDF renamed, or we need python-docx)
# Let's try as PDF first since the previous IELTS file worked
try:
    r = PdfReader(r'c:\Users\z1309\Documents\xwechat_files\wxid_5pg1904cumf012_bc58\msg\file\2026-06\常用英语500句.doc')
    print(f'PDF pages: {len(r.pages)}')
    text = ''
    for p in r.pages:
        t = p.extract_text()
        if t: text += t + '\n'
    print(text[:5000])
except Exception as e:
    print(f'Not a PDF: {e}')
    # Try as text
    try:
        with open(r'c:\Users\z1309\Documents\xwechat_files\wxid_5pg1904cumf012_bc58\msg\file\2026-06\常用英语500句.doc', 'r', encoding='utf-8') as f:
            print(f.read()[:2000])
    except Exception as e2:
        print(f'Not text either: {e2}')
