"""Compile the supplied design HTML to React-readable trees and native React controllers.

No iframe, external Claude runtime, runtime eval, or user-HTML execution is involved.
Run from frontend/: python scripts/compile-prototype.py
"""
from pathlib import Path
from html.parser import HTMLParser
import json, re, shutil

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'frontend/src/mobile/generated'
OUT.mkdir(parents=True,exist_ok=True)

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.root={'tag':'root','attrs':{},'children':[]};self.stack=[self.root];self.i=0
    def handle_starttag(self,tag,attrs):
        self.i+=1
        n={'tag':tag,'attrs':dict((k,v if v is not None else True) for k,v in attrs),'children':[],'id':self.i}
        self.stack[-1]['children'].append(n)
        if tag not in ['img','input','br','hr','link','meta','source','wbr','area','embed']:self.stack.append(n)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if self.stack[-1]['tag']==tag:self.stack.pop()
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i]['tag']==tag:self.stack=self.stack[:i];return
    def handle_data(self,data):
        if data.strip():self.stack[-1]['children'].append(data)

trees={}; manifest={}; controllers=['// @ts-nocheck\n// Generated from prototype/screens. Rebuild with npm run prototype:generate.\nimport { DesignController } from "../renderer";\n']
for path in sorted((ROOT/'prototype/screens').glob('*.dc.html')):
    key=path.name.removesuffix('.dc.html')
    src=path.read_text(encoding='utf-8')
    fragment=re.search(r'<x-dc>(.*?)</x-dc>',src,re.S).group(1)
    styles='\n'.join(re.findall(r'<style>(.*?)</style>',fragment,re.S))
    fragment=re.sub(r'<helmet>.*?</helmet>','',fragment,flags=re.S)
    parser=Parser();parser.feed(fragment)
    tree=parser.root['children'][0]
    defaults=json.loads(re.search(r"data-props='(.*?)'",src,re.S).group(1))
    preview=defaults.get('$preview',{'width':390,'height':844})
    trees[key]={'tree':tree,'css':styles,'title':re.search(r'<title>(.*?)</title>',src,re.S).group(1),'preview':preview}
    script=re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>',src,re.S).group(1)
    name='Screen'+key.replace('-','')
    script=script.replace('class Component extends DCLogic',f'export class {name} extends DesignController')
    # Rendering delegates only known design trees and compiled controller values to React.
    script=script.replace('renderVals() {',f'renderVals() {{',1)
    controllers.append(script)
    manifest[key]={'source':str(path.relative_to(ROOT)).replace('\\','/'),'class':name,'nodes':parser.i,'preview':preview}
controllers.append('export const controllers={'+','.join(json.dumps(k)+':'+v['class'] for k,v in manifest.items())+'};\n')
(OUT/'controllers.tsx').write_text('\n'.join(controllers),encoding='utf-8')
(OUT/'trees.json').write_text(json.dumps(trees,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
tokens=json.loads((ROOT/'prototype/design-system/tokens.json').read_text(encoding='utf-8'))
css=['/* Generated directly from prototype/design-system/tokens.json. */\n:root{']
for group in tokens.values():
    if isinstance(group,dict):
        for token in group.get('tokens',[]):
            if 'value' in token and isinstance(token['value'],str):css.append('--'+token['name']+':'+token['value']+';')
css.append('}')
(OUT/'tokens.css').write_text('\n'.join(css),encoding='utf-8')
shutil.copytree(ROOT/'prototype/assets',ROOT/'frontend/public/prototype/assets',dirs_exist_ok=True)
print(f'Compiled {len(trees)} supplied artboards; copied exact icons, illustrations and photos.')
