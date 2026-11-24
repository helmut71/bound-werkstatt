import re
s=lambda n: open(f'src/{n}').read()
app="window.__SRC='<!DOCTYPE html>\\n'+document.documentElement.outerHTML;\n"+"\n".join(s(n) for n in ['core.js','qr.js','ui.js','player.js','editor.js','main.js'])
assert '</script' not in app.lower().replace("'</'+'script>'",'')
html=s('head.html').replace('/*APP*/',app.replace('\\','\\\\') if False else app)
open('index.html','w').write(html)
print(len(html))
