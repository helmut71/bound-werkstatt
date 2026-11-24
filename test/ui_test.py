import sys, json
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1400,'height':900})
    pg.on('console',lambda m: errs.append(('console',m.type,m.text)) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    pg.goto('file:///home/claude/bw/index.html'); pg.wait_for_timeout(800)
    print('items',pg.locator('#el-list > li').count())
    pg.screenshot(path='s1.png')
    # click through every element in editor to render each form
    n=pg.locator('#el-list > li').count()
    for i in range(n):
        pg.locator('#el-list > li').nth(i).click(); pg.wait_for_timeout(120)
    # add each type
    for t in ['info','quiz','mission','code','location','survey','timer','choice','jump','action','end']:
        pg.click('#add-btn'); pg.locator('#add-menu .addit').nth(['info','quiz','mission','code','location','survey','timer','choice','jump','action','end'].index(t)).click(); pg.wait_for_timeout(80)
    print('items after add',pg.locator('#el-list > li').count())
    # source tab
    pg.click('#tab-src'); pg.wait_for_timeout(100)
    js=pg.input_value('#src'); d=json.loads(js); print('json elements',len(d['elements']))
    pg.screenshot(path='s2.png')
    print('ERRS',errs)
    b.close()
