"""Prueba en Firefox la dirección que se comparte con el alumnado."""
from pathlib import Path
import shutil
import subprocess
import sys

from check_firefox import Firefox, ROOT, check_assumptions, snapshot, wait_for


SITE = 'https://mendezmariano.github.io/planificacion/'
output = Path(sys.argv[1])
browser = Firefox('http://127.0.0.1:4444', ROOT)
session = browser.request('POST', '/session', {'capabilities': {'alwaysMatch': {
    'browserName': 'firefox', 'webSocketUrl': True,
    'moz:firefoxOptions': {'binary': shutil.which('firefox'), 'args': ['-headless']},
}}}, session=False)
browser.session = session['sessionId']
try:
    browser.request('POST', '/timeouts', {'pageLoad': 30000, 'script': 10000})
    lab = browser.request('GET', '/window')
    for width in [1280, 360]:
        browser.request('POST', '/window/rect', {'width': width, 'height': 1000})
        subprocess.run(['node', '--experimental-websocket', str(ROOT/'scripts/firefox_viewport.mjs'),
                        session['capabilities']['webSocketUrl'], lab, str(width), '900'],
                       check=True, timeout=15)
        browser.request('POST', '/url', {'url': SITE})
        wait_for(lambda: browser.request('GET', '/url') == SITE+'dist/index.html', 'entrada desde la portada')
        wait_for(lambda: browser.execute("return !!document.getElementById('time')?.dataset.time"),
                 'inicio del laboratorio')
        check_assumptions(browser, {'checks': []})

        browser.request('POST', '/url', {'url': SITE+'?figura=7.3'})
        wait_for(lambda: browser.request('GET', '/url') == SITE+'dist/index.html?figura=7.3',
                 'enlace directo a SJF')
        wait_for(lambda: browser.execute("return document.getElementById('chapterReference')?.textContent === 'Figura 7.3 · SJF · Sección 7.4'"),
                 'encabezado de la figura 7.3')
        wait_for(lambda: snapshot(browser)['t'] > 0, 'avance automático de SJF')
        assert browser.text('#relaxedAssumptions') == 'Se relaja el supuesto 1 (igual duración).'
        browser.click('#end')
        assert '(10 + 20 + 120) / 3 = 50 s' in browser.text('#calculations')
        assert browser.execute('return innerWidth === arguments[0] && document.documentElement.scrollWidth <= innerWidth', width)
        browser.execute('window.scrollTo(0,0)')
        browser.screenshot(output/f'pages-{width}-figura-7.3.png')
        print(f'Página pública a {width} px: SJF, retorno medio de 50 s, cinco supuestos y navegación por teclado.')

    pdf = SITE+'recursos/Capitulo_7_Planificacion_ES.pdf'
    assert browser.execute("return document.getElementById('chapterPdf').href") == pdf
    browser.click('#chapterPdf')
    wait_for(lambda: len(browser.request('GET', '/window/handles')) == 2, 'pestaña del apunte')
    tab = next(handle for handle in browser.request('GET', '/window/handles') if handle != lab)
    browser.request('POST', '/window', {'handle': tab})
    wait_for(lambda: browser.request('GET', '/url') == pdf, 'URL del apunte')
    wait_for(lambda: browser.execute("""return !!document.querySelector('#viewer .page[data-page-number="1"]')"""),
             'primera página del PDF público', timeout=20)
    print('El visor de Firefox abrió la primera página del apunte desde GitHub Pages.')
except Exception:
    browser.screenshot(output/'pages-error.png')
    raise
finally:
    browser.request('DELETE', '')
