#!/usr/bin/env python3
"""Simulaciones y cuentas del capítulo 7 en Firefox real mediante WebDriver, sin bibliotecas Python externas."""
import argparse
import base64
import json
from pathlib import Path
import shutil
import socket
import subprocess
import time
import traceback
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
ROOT = Path(__file__).resolve().parents[1]


class Firefox:
    def __init__(self, address):
        self.address = address
        self.session = None

    def request(self, method, path, payload=None, session=True):
        prefix = '/session/' + self.session if session else ''
        data = None if payload is None else json.dumps(payload).encode()
        request = Request(self.address + prefix + path, data=data, method=method,
                          headers={'Content-Type': 'application/json'})
        try:
            with urlopen(request, timeout=40) as response:
                return json.load(response)['value']
        except HTTPError as error:
            raise RuntimeError(error.read().decode()) from error

    def execute(self, script, *args):
        return self.request('POST', '/execute/sync', {'script': script, 'args': args})

    def element(self, selector):
        return self.request('POST', '/element', {'using': 'css selector', 'value': selector})[ELEMENT]

    def click(self, selector):
        self.request('POST', '/element/' + self.element(selector) + '/click', {})

    def fill(self, selector, value):
        element = self.element(selector)
        if not self.execute('return document.activeElement === document.querySelector(arguments[0]);', selector):
            self.click(selector)
        # Soltar Ctrl antes de escribir. Enviar todo como una cadena a Gecko puede
        # dejar Ctrl activo y convertir el primer dígito en un atajo de teclado.
        self.key('a', modifier='\ue009')
        self.request('POST', '/element/' + element + '/value', {'text': value})
        actual = self.execute('return document.querySelector(arguments[0]).value;', selector)
        assert actual == value, f'{selector}: se quiso escribir {value!r}, quedó {actual!r}'

    def select(self, selector, value):
        option = self.execute('return [...document.querySelector(arguments[0]).options].find(o => o.value === arguments[1]);', selector, value)
        assert option, (selector, value)
        self.request('POST', '/element/' + option[ELEMENT] + '/click', {})

    def key(self, key, modifier=None):
        keys = [modifier, key] if modifier else [key]
        actions = [{'type': 'keyDown', 'value': k} for k in keys]
        actions.extend({'type': 'keyUp', 'value': k} for k in reversed(keys))
        self.request('POST', '/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': actions}]})

    def tab_to(self, element_id, backwards=False):
        for _ in range(60):
            if self.execute('return document.hasFocus() && document.activeElement.id === arguments[0];', element_id):
                return
            self.key('\ue004', modifier='\ue008' if backwards else None)
        raise AssertionError('No se alcanza con Tab: ' + element_id)

    def text(self, selector):
        return self.execute('return document.querySelector(arguments[0]).textContent;', selector)

    def screenshot(self, path, selector=None):
        suffix = '/screenshot' if selector is None else '/element/' + self.element(selector) + '/screenshot'
        path.write_bytes(base64.b64decode(self.request('GET', suffix)))

    def open(self, query=''):
        self.request('POST', '/url', {'url': (ROOT / 'dist/index.html').as_uri() + query})


def wait_for(predicate, description, timeout=6):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError('No ocurrió: ' + description)


def snapshot(browser):
    return browser.execute("""
      const text = id => document.getElementById(id)?.textContent;
      const jobs = [...document.querySelectorAll('#jobs .job:not([hidden])')].map(row => ({
        id:row.dataset.id, state:row.querySelector('.state').textContent,
        used:Number(row.querySelector('.bar').getAttribute('aria-valuenow')),
        fill:row.querySelector('.bar-fill').getBoundingClientRect().width,
        left:row.querySelector('.left').textContent
      }));
      return { time:text('time'), t:Number(document.getElementById('time').dataset.time),
        cpu:text('cpu'), disk:text('disk'), ready:text('ready'), jobs,
        results:!document.getElementById('results').hidden };
    """)


def scrub(browser, instant):
    # Mismo evento que produce el control de tiempo al arrastrarlo.
    browser.execute("""
      const range = document.getElementById('seek');
      range.value = arguments[0];
      range.dispatchEvent(new Event('input', {bubbles:true}));
    """, instant)


def disclosure(browser, name, opened):
    if browser.execute("return document.getElementById(arguments[0]).open;", name) != opened:
        browser.click('#' + name + ' summary')


def check_figures(browser, report):
    data = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./test/fixtures/chapter7.js')))"], cwd=ROOT)
    disclosure(browser, 'technical', True)
    for spec in json.loads(data):
        figure = spec['figure']
        report['stage'] = 'Figura ' + figure
        browser.select('#figure', figure)
        browser.click('#reset')
        assert browser.text('#chapterMode') == 'Configuración del apunte'
        assert 'Figura ' + figure in browser.text('#chapterReference')
        assert browser.text('#chapterAssumptions').strip()
        assert not snapshot(browser)['results']
        unit = 'ms' if spec['caseId'] == 'disco' else 's'
        frames = [s[0] for s in spec['cpu']] + [spec['cpu'][-1][1]]
        middle = [(start + end) // 2 for start, end, job in spec['cpu']]
        for instant in sorted(set(frames + middle)):
            scrub(browser, instant)
            current = snapshot(browser)
            index = max(i for i, t in enumerate(frames) if t <= instant)
            cpu = spec['cpu'][index][2] if index < len(spec['cpu']) else None
            disk = next((s[2] for s in spec.get('disk', []) if s[0] <= instant < s[1]), None)
            assert current['time'] == f'{instant} {unit}', (figure, current)
            assert current['cpu'] == (cpu or 'Ociosa'), (figure, current)
            assert current['disk'] == (disk or 'Libre'), (figure, current)
            assert current['ready'] == (', '.join(spec['ready'][index]) or 'Vacía'), (figure, current)
            expected_ids = [m[0] for m in spec['metrics'] if spec['caseId'] != 'tardias' or m[0] == 'A' or instant >= 10]
            assert [row['id'] for row in current['jobs']] == expected_ids, (figure, instant, current)
            for row in current['jobs']:
                intervals = [s for s in spec['cpu'] if s[2] == row['id']]
                demand = sum(end-start for start,end,_ in intervals)
                used = sum(max(0, min(instant,end)-start) for start,end,_ in intervals)
                assert row['used'] == used, (figure, instant, row)
                assert row['left'] == f'Restan {demand} − {used} = {demand-used} {unit}', (figure, instant, row)
        assert current['results']
        labels = browser.execute("""
          return [...document.querySelectorAll('#timeline text')].filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{
            const matrix=n.getScreenCTM();
            return {text:n.textContent, pixels:parseFloat(getComputedStyle(n).fontSize)*Math.hypot(matrix.c,matrix.d)};
          });
        """)
        assert all(label['pixels'] >= 11.9 for label in labels), (figure, labels)
        expected_runs = []
        for _, _, job in spec['cpu']:
            symbol = job or '–'
            if expected_runs[-1:] != [symbol]:
                expected_runs.append(symbol)
        expected_runs += [s[2] for s in spec.get('disk', [])]
        visible = [label['text'] for label in labels if label['text'] in expected_runs]
        assert visible == expected_runs, (figure, visible, expected_runs)
        rows = browser.execute("return [...document.querySelector('#resultTables table').tBodies[0].rows].map(r=>[...r.cells].map(c=>c.textContent));")
        expected = []
        for name, first, finish, waiting in spec['metrics']:
            arrival = 10 if spec['caseId'] == 'tardias' and name != 'A' else 0
            expected.append(list(map(str, [name, arrival, first, finish, first-arrival, finish-arrival, waiting])))
        assert rows == expected, (figure, rows, expected)
        formulas = browser.execute("return [...document.querySelectorAll('.formula')].map(x=>x.textContent);")
        totals = {
            '7.1':['(10 + 20 + 30) / 3 = 20 s'], '7.2':['(100 + 110 + 120) / 3 = 110 s'],
            '7.3':['(10 + 20 + 120) / 3 = 50 s'], '7.4':['[100 + (110 − 10) + (120 − 10)] / 3 ≈ 103,33 s'],
            '7.5':['[(120 − 0) + (20 − 10) + (30 − 10)] / 3 = 50 s'],
            '7.6':['(0 + 5 + 10) / 3 = 5 s'], '7.7':['(0 + 1 + 2) / 3 = 1 s','(13 + 14 + 15) / 3 = 14 s'],
            '7.8':['50 + (4 × 10) + 50 = 140 ms'], '7.9':['50 + (4 × 10) + 50 − 40 = 100 ms']
        }
        for text in totals[figure]:
            assert any(text in formula for formula in formulas), (figure, formulas)
        assert browser.execute("return [...document.querySelectorAll('.mean-value')].every(n => n.getClientRects().length === 1)"), figure
        report['checks'].append('Figura ' + figure + ': llegadas, consumo, recursos, colas, intervalos y cuentas del apunte')
    disclosure(browser, 'technical', False)


def check_controls(browser, report):
    report['stage'] = 'Reproducción continua y color de los trabajos'
    browser.select('#figure', '7.5')
    wait_for(lambda: snapshot(browser)['t'] > 0, 'el reloj avanza al elegir una figura')
    before = snapshot(browser)
    wait_for(lambda: snapshot(browser)['jobs'][0]['fill'] > before['jobs'][0]['fill'] + 1, 'la parte clara de A crece durante el tramo')
    browser.click('#play')
    paused = snapshot(browser)
    time.sleep(0.45)
    assert snapshot(browser) == paused, 'Pausar debe conservar reloj, barras y cuentas'
    browser.click('#play')
    wait_for(lambda: snapshot(browser)['t'] > paused['t'], 'reanudar desde el tiempo observado')
    report['checks'].append('Reproducción automática, consumo entre eventos, pausa y reanudación')

    report['stage'] = 'Retorno observado y retroceso'
    scrub(browser, 20)
    assert '20 − 10 = 10 s' in browser.text('[data-metric="finish"] [data-for=B]')
    assert 'Pendiente' in browser.text('[data-metric="finish"] [data-for=A]')
    assert 'Pendiente' in browser.text('[data-metric="finish"] [data-for=C]')
    scrub(browser, 35)
    assert browser.text('.job[data-id=A] .used') == 'Ejecutó 10 + (35 − 30) = 15 s'
    assert browser.text('.job[data-id=A] .wait') == 'Espera en listos 30 − 10 = 20 s'
    assert browser.text('.job[data-id=A] .left') == 'Restan 100 − 15 = 85 s'
    browser.click('#prev')
    assert snapshot(browser)['t'] == 30
    browser.click('#reset')
    assert snapshot(browser)['t'] == 0
    assert 'Pendiente' in browser.text('[data-for=B]') and len(snapshot(browser)['jobs']) == 1
    browser.tab_to('next')
    assert float(browser.execute('return getComputedStyle(document.activeElement).outlineWidth;').removesuffix('px')) > 0
    browser.key('\ue007')
    wait_for(lambda: snapshot(browser)['t'] == 10, 'Siguiente se detiene en 10 s')
    browser.click('#seek')
    browser.key('\ue011')  # Inicio
    browser.key('\ue014')  # Flecha derecha
    assert snapshot(browser)['t'] == 1
    report['checks'].append('Figura 7.5 a 20 y 35 s, retroceso, reinicio y teclado')

    report['stage'] = 'Segunda lectura de STCF y disco a 80 ms'
    browser.select('#figure', 'respuesta')
    scrub(browser, 10)
    assert 'Pendiente' in browser.text('[data-metric="first"] [data-for=C]')
    scrub(browser, 20)
    assert '[(0 − 0) + (10 − 10) + (20 − 10)] / 3 ≈ 3,33 s' == browser.text('.formula')
    browser.select('#figure', '7.9')
    scrub(browser, 15)
    assert snapshot(browser)['jobs'][0]['state'] == 'Espera E/S'
    assert '5 ms coinciden' in browser.text('.io-detail')
    scrub(browser, 80)
    assert 'empatan en 10 ms' in browser.text('#decision') and 'Ejecuta A' in browser.text('#decision')
    report['checks'].append('Sección 7.6 con la figura 7.5 y superposición de la figura 7.9')

    report['stage'] = 'Explorar variantes y escribir una carga propia'
    browser.select('#figure', '7.7')
    browser.select('#speed', '4')
    wait_for(lambda: snapshot(browser)['results'], 'RR termina sus 15 turnos en reproducción automática', timeout=12)
    assert snapshot(browser)['time'] == '15 s'
    assert browser.text('[data-metric="finish"] .formula') == '(13 + 14 + 15) / 3 = 14 s'
    browser.select('#speed', '1')
    report['checks'].append('RR reproduce de principio a fin y completa los dos promedios')
    disclosure(browser, 'settings', True)
    browser.fill('#q', '5')
    browser.key('\ue004')
    assert browser.text('#chapterMode') == 'Variante del apunte'
    browser.select('#figure', '7.5')
    browser.select('#figure', '7.7')
    assert browser.execute("return document.getElementById('q').value") == '1'
    assert browser.text('#chapterMode') == 'Configuración del apunte'
    browser.click('#q')
    browser.tab_to('configBtn')
    browser.key('\ue007')
    browser.tab_to('edit')
    browser.fill('#edit', '6, 2\n2, 1\n6, 2')
    browser.tab_to('save')
    browser.key('\ue007')
    assert not browser.execute("return document.querySelector('dialog').open")
    assert browser.execute('return document.activeElement.id') == 'configBtn'
    assert browser.text('#chapterMode') == 'Carga propia'
    browser.select('#policy', 'FIFO')
    scrub(browser, 0)
    assert not snapshot(browser)['jobs']
    scrub(browser, 6)
    assert [j['id'] for j in snapshot(browser)['jobs']] == ['B','A','C']
    browser.click('#end')
    assert snapshot(browser)['time'] == '10 s'
    browser.click('#configBtn')
    browser.key('\ue00c')
    assert not browser.execute("return document.querySelector('dialog').open")
    assert browser.execute('return document.activeElement.id') == 'configBtn'
    report['checks'].append('Selección de política, cuanto original, carga propia y foco del diálogo')

    report['stage'] = 'Enlaces directos'
    for query, ref in [('?sim=STCF&caso=tardias','Sección 7.5 · Figura 7.5'), ('?seccion=7.6','Sección 7.6 · Figura 7.5'),
                       ('?figura=7.7','Sección 7.7 · Figura 7.7')]:
        browser.open(query)
        assert browser.text('#chapterReference') == ref
    report['checks'].append('Apertura directa por figura, sección y combinación de política y carga')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--firefox', default=shutil.which('firefox'))
    parser.add_argument('--geckodriver', default=shutil.which('geckodriver'))
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--headed', action='store_true', help='Mostrar la ventana de prueba')
    args = parser.parse_args()
    if not args.firefox or not args.geckodriver:
        parser.error('Indicá las rutas de Firefox y geckodriver.')
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'failed', 'checks': [], 'screenshots': [], 'viewports': []}
    process = None
    browser = None
    try:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        with (output / 'geckodriver.log').open('w') as log:
            process = subprocess.Popen([args.geckodriver, '--host', '127.0.0.1', '--port', str(port)], stdout=log, stderr=log)
        browser = Firefox('http://127.0.0.1:' + str(port))
        def driver_ready():
            if process.poll() is not None:
                raise RuntimeError('geckodriver terminó; revisá geckodriver.log')
            try:
                return browser.request('GET', '/status', session=False)['ready']
            except URLError:
                return False
        wait_for(driver_ready, 'inicio de geckodriver', timeout=10)
        # El proxy inaccesible impide que la página dependa de recursos de Internet.
        prefs = {'network.proxy.type': 1, 'network.proxy.http': '127.0.0.1', 'network.proxy.http_port': 9,
                 'network.proxy.ssl': '127.0.0.1', 'network.proxy.ssl_port': 9, 'network.proxy.no_proxies_on': ''}
        session = browser.request('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'firefox', 'webSocketUrl': True,
            'moz:firefoxOptions': {'binary': args.firefox, 'args': [] if args.headed else ['-headless'], 'prefs': prefs}}}}, session=False)
        browser.session = session['sessionId']
        report['browser'] = session['capabilities']['browserName'] + ' ' + session['capabilities']['browserVersion']
        browser.request('POST', '/timeouts', {'implicit': 2000, 'pageLoad': 15000, 'script': 10000})
        handle = browser.request('GET', '/window')
        for width in [1280, 360]:
            report['stage'] = 'Preparar pantalla de ' + str(width) + ' px'
            browser.request('POST', '/window/rect', {'width': width, 'height': 1000})
            viewport_command = ['node', '--experimental-websocket', str(ROOT/'scripts/firefox_viewport.mjs'),
                                session['capabilities']['webSocketUrl'], handle, str(width), '900']
            sized = subprocess.run(viewport_command, capture_output=True, text=True, timeout=15)
            if sized.returncode:
                raise RuntimeError(f'Firefox no pudo fijar el área de contenido en {width} px: {sized.stderr.strip()}')
            browser.open()
            viewport = browser.execute('return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};')
            report['viewports'].append(viewport)
            assert viewport['width'] == width, ('Ancho solicitado y real distintos', width, viewport)
            assert viewport['scrollWidth'] <= width, ('Desborde horizontal', viewport)
            assert browser.text('#chapterReference') == 'Sección 7.3 · Figura 7.1'
            wait_for(lambda: snapshot(browser)['t'] > 0, 'reproducción inicial de la figura 7.1')
            check_figures(browser, report)
            check_controls(browser, report)
            for figure, instant, label in [('7.1', 5, 'inicio'), ('7.5', 35, 'reanudacion'), ('7.9', 15, 'disco')]:
                browser.select('#figure', figure)
                scrub(browser, instant)
                browser.execute('window.scrollTo(0,0)')
                assert browser.execute('return document.documentElement.scrollWidth <= innerWidth')
                for name, selector in [(label, None), (label+'-cuentas', '.accounts')]:
                    filename = f'firefox-{width}-{name}.png'
                    browser.screenshot(output/filename, selector)
                    report['screenshots'].append(filename)
            browser.select('#figure', '7.5')
            browser.click('#end')
            filename = f'firefox-{width}-retorno-final.png'
            browser.screenshot(output/filename, '.accounts')
            report['screenshots'].append(filename)
            resources = browser.execute("return performance.getEntriesByType('resource').map(r=>r.name);")
            assert all(url.startswith('file:') for url in resources), resources
            report['checks'].append(f'Apertura file:// y recursos locales a {width} px')
        report['status'] = 'passed'
        report['stage'] = 'Recorrido completo'
    except Exception as error:
        location = traceback.extract_tb(error.__traceback__)[-1]
        detail = str(error) or location.line or 'Sin detalle'
        report['error'] = f'{type(error).__name__}: {detail}'
        report['failure_location'] = {'file': location.filename, 'line': location.lineno, 'function': location.name}
        report['traceback'] = traceback.format_exc()
        if browser and browser.session:
            try:
                browser.screenshot(output/'failure.png')
                report['screenshots'].append('failure.png')
            except Exception:
                pass
    finally:
        if browser and browser.session:
            try:
                browser.request('DELETE', '')
            except Exception:
                pass
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        (output/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
