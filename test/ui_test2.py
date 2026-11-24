import json
from playwright.sync_api import sync_playwright
errs=[]
def ok(c,m): print(('PASS ' if c else 'FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/bw/index.html'); pg.wait_for_timeout(500)
    # --- Vorschau: von vorn spielen
    pg.click('#pv-toggle'); pg.wait_for_timeout(300)
    P='#phone-in >> '
    pg.click(P+'text=Los geht’s'); pg.wait_for_timeout(100)
    pg.click(P+'text=Los geht’s')      # info button
    ok('Fluss' in pg.inner_text(P+'.pl-card'),'quiz 1 sichtbar')
    pg.click(P+'.opt >> text=Wienfluss'); pg.click(P+'text=Antwort prüfen')
    ok('Richtig' in pg.inner_text(P+'.pl-fb'),'quiz richtig')
    pg.click(P+'button:text-is("Weiter")')
    pg.fill(P+'#q-in','strauss'); pg.click(P+'text=Antwort prüfen'); pg.click(P+'button:text-is("Weiter")')
    pg.fill(P+'#c-in','park1'); pg.click(P+'text=Code prüfen'); pg.click(P+'button:text-is("Weiter")')
    ok('Denkmal' in pg.inner_text(P+'.pl-card'),'location sichtbar')
    pg.click(P+'text=Test: am Ziel'); pg.wait_for_timeout(100); pg.click(P+'button:text-is("Weiter")')
    pg.click(P+'.opt.go >> nth=1'); pg.wait_for_timeout(100)   # sportlicher Weg -> w-b timer
    ok('Bewegung' in pg.inner_text(P+'.pl-card'),'Verzweigung -> Timer')
    pg.click(P+'summary'); pg.click(P+'button:text-is("⏭ Überspringen")')   # Testwerkzeug
    pg.wait_for_timeout(100)
    ok('Wasserkreislauf' in pg.inner_text(P+'.pl-card'),'weiter zu Sortieren (Pfad B)')
    # sort: bringe in richtige Reihenfolge durch Klicks – teste nur Antwort pruefen (falsch erlaubt)
    pg.click(P+'text=Antwort prüfen'); pg.wait_for_timeout(50)
    pg.screenshot(path='s3.png')
    # --- Speichern/Import Roundtrip
    with pg.expect_download() as dl0: pg.click('#b-save')
    dl0.value.save_as('/home/claude/bw/test/tmp.json'); d=json.load(open('/home/claude/bw/test/tmp.json'))
    d['meta']['title']='Importiert!'; d['elements']=d['elements'][:3]; json.dump(d,open('/home/claude/bw/test/tmp.json','w'))
    pg.set_input_files('#file-in','/home/claude/bw/test/tmp.json'); pg.wait_for_timeout(300)
    ok(pg.input_value('#bound-title')=='Importiert!','JSON importiert')
    ok(pg.locator('#el-list > li').count()==3,'3 Elemente nach Import')
    ok(pg.locator('text=JSON-Quelle').count()==0,'kein Reiter JSON-Quelle mehr')
    # Undo
    pg.click('#b-undo'); pg.wait_for_timeout(200)
    ok(pg.locator('#el-list > li').count()==16,'Undo stellt Beispiel her')
    # Autosave -> Reload
    pg.click('#el-list > li >> nth=1'); pg.fill('#form input[type=text] >> nth=0','Geändert'); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_timeout(500)
    ok('Geändert' in pg.inner_text('#el-list'),'Autosave überlebt Reload')
    # Export Player-Datei: Download abfangen
    with pg.expect_download() as dl: pg.click('#b-export')
    path=dl.value.path(); dl.value.save_as('/home/claude/bw/test/player.html')
    # QR-Modal
    pg.click('#b-qr'); pg.wait_for_timeout(200); ok(pg.locator('.qr').count()==1,'QR-Karte erzeugt'); pg.screenshot(path='s4.png'); pg.keyboard.press('Escape'); pg.click('.modal-head button')
    # Speichern JSON
    with pg.expect_download() as dl2: pg.click('#b-save')
    print('save name',dl2.value.suggested_filename)
    # --- Standalone Player
    pg2=ctx.new_page(); pg2.on('pageerror',lambda e: errs.append('P2:'+str(e)))
    pg2.set_viewport_size({'width':420,'height':800})
    pg2.goto('file:///home/claude/bw/test/player.html'); pg2.wait_for_timeout(500)
    ok(pg2.locator('#app').is_hidden(),'Player-Datei blendet Editor aus')
    pg2.fill('#pl-name-in','Anna'); pg2.click('text=Los geht’s'); pg2.wait_for_timeout(100)
    ok(pg2.locator('.pl-bar').is_visible(),'Spiel läuft')
    pg2.reload(); pg2.wait_for_timeout(400)
    ok(pg2.locator('text=Fortsetzen').count()==1,'Fortsetzen nach Reload')
    pg2.screenshot(path='s5.png')
    pg2.goto('file:///home/claude/bw/test/player.html#edit'); pg2.reload(); pg2.wait_for_timeout(500)
    ok(pg2.locator('#app').is_visible(),'#edit öffnet Editor')
    # schmaler Bildschirm Editor
    pg3=ctx.new_page(); pg3.set_viewport_size({'width':390,'height':780}); pg3.goto('file:///home/claude/bw/index.html'); pg3.wait_for_timeout(400)
    pg3.screenshot(path='s6.png'); pg3.click('#mtabs [data-p=prev]'); pg3.wait_for_timeout(200); pg3.screenshot(path='s7.png')
    print('PAGEERRORS',errs)
    b.close()
