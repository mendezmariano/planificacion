#!/usr/bin/env python3
"""Recorrido de B01/B02 en Firefox real mediante WebDriver, sin bibliotecas Python externas."""
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
        self.request('POST', '/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
            {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': 'a'},
            {'type': 'keyUp', 'value': 'a'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
        self.request('POST', '/element/' + element + '/value', {'text': value})
        actual = self.execute('return document.querySelector(arguments[0]).value;', selector)
        assert actual == value, f'{selector}: se quiso escribir {value!r}, quedó {actual!r}'

    def select(self, selector, value):
        option = self.execute('return [...document.querySelector(arguments[0]).options].find(o => o.value === arguments[1]);', selector, value)
        assert option, (selector, value)
        self.request('POST', '/element/' + option[ELEMENT] + '/click', {})

    def key(self, key):
        self.request('POST', '/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
            {'type': 'keyDown', 'value': key}, {'type': 'keyUp', 'value': key}]}]})

    def tab_to(self, element_id):
        for _ in range(60):
            if self.execute('return document.activeElement.id;') == element_id:
                return
            self.key('\ue004')
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
      const badges = id => [...document.querySelectorAll('#'+id+' .badge')].map(n=>n.textContent);
      return {time:document.getElementById('time').textContent,
        cpu:badges('cpu'), disk:badges('disk'), ready:badges('ready'),
        results:!document.getElementById('results').hidden,
        event:document.getElementById('eventnum').textContent};
    """)


def check_figures(browser, report):
    data = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./test/fixtures/chapter7.js')))"], cwd=ROOT)
    for spec in json.loads(data):
        report['stage'] = 'Figura ' + spec['figure']
        browser.select('#policy', spec['policy'])
        if spec['policy'] != 'SERIE':
            browser.select('#case', spec['caseId'])
        browser.click('#prepare')
        assert browser.text('#chapterMode') == 'Configuración del apunte'
        assert 'Figura ' + spec['figure'] + ':' in browser.text('#chapterReference')
        assert browser.text('#chapterAssumptions').strip()
        assert browser.text('#chapterQuestion').strip()
        assert not snapshot(browser)['results']
        times = [row[0] for row in spec['cpu']] + [spec['cpu'][-1][1]]
        unit = 'ms' if spec['caseId'] == 'disco' else 's'
        for i, instant in enumerate(times):
            browser.click('#next')
            current = snapshot(browser)
            cpu = spec['cpu'][i][2] if i < len(spec['cpu']) else None
            disk = next((row[2] for row in spec.get('disk', []) if row[0] <= instant < row[1]), None)
            assert current['time'] == f't = {instant} {unit}', (spec['figure'], current)
            assert current['cpu'] == ([] if cpu is None else [cpu]), (spec['figure'], current)
            assert current['disk'] == ([] if disk is None else [disk]), (spec['figure'], current)
            assert current['ready'] == list(spec['ready'][i]), (spec['figure'], current)
        assert current['results']
        # Leer texto, sin usar las métricas internas de la aplicación como resultado esperado.
        rows = browser.execute("return [...[...document.querySelectorAll('#results table')].at(-1).tBodies[0].rows].map(r=>[...r.cells].map(c=>c.textContent));")
        expected = []
        for name, first, finish, waiting in spec['metrics']:
            arrival = 10 if spec['caseId'] == 'tardias' and name != 'A' else 0
            expected.append(list(map(str, [name, arrival, first, finish, first-arrival, finish-arrival, waiting])))
        assert rows == expected, (spec['figure'], rows, expected)
        browser.click('#prev')
        assert not snapshot(browser)['results']
        browser.click('#next')
        assert snapshot(browser)['results']
        browser.click('#reset')
        assert snapshot(browser)['event'].startswith('0/')
        report['checks'].append('Figura ' + spec['figure'] + ': panel, fronteras, colas y métricas visibles')


def check_controls(browser, report):
    report['stage'] = 'Cambiar el cuanto y restaurar la configuración original'
    browser.select('#policy', 'RR')
    browser.select('#case', 'terminales')
    browser.fill('#q', '5')
    browser.key('\ue004')
    assert browser.text('#chapterMode') == 'Variante del apunte', 'RR con cuanto 5 debe ser una variante'
    browser.fill('#q', '1')
    browser.key('\ue004')
    assert browser.text('#chapterMode') == 'Configuración del apunte', 'RR con cuanto 1 debe recuperar la figura 7.7'
    report['checks'].append('Cambiar el cuanto a 5 y volver a 1 actualiza la referencia del apunte')
    report['stage'] = 'Reproducir y pausar'
    browser.select('#speed', '1200')
    browser.click('#play')
    wait_for(lambda: not snapshot(browser)['event'].startswith('0/'), 'primer avance de reproducción')
    browser.click('#play')
    paused = snapshot(browser)['event']
    time.sleep(1.5)
    assert snapshot(browser)['event'] == paused, 'La reproducción avanzó después de pausar'
    report['checks'].append('Reproducción y pausa')
    report['stage'] = 'Avanzar con teclado'
    browser.click('#reset')
    browser.tab_to('next')
    outline = browser.execute('return getComputedStyle(document.activeElement).outlineWidth;')
    assert float(outline.removesuffix('px')) > 0, 'El foco de teclado no es visible'
    browser.key('\ue007')
    assert snapshot(browser)['event'].startswith('1/'), 'Enter sobre Siguiente debe avanzar un evento'
    report['checks'].append('Tab, foco visible y avance con Enter')
    report['stage'] = 'Editar y guardar una carga propia con teclado'
    browser.tab_to('configBtn')
    browser.key('\ue007')
    assert browser.execute("return document.querySelector('dialog').open;")
    browser.tab_to('edit')
    browser.fill('#edit', '0, 3\n2, 1\n2, 2')
    browser.tab_to('save')
    browser.key('\ue007')
    assert not browser.execute("return document.querySelector('dialog').open;")
    assert browser.execute('return document.activeElement.id;') == 'configBtn', 'Guardar debe devolver el foco al botón de carga'
    assert browser.text('#chapterMode') == 'Carga propia'
    assert 'Sin figura asociada' in browser.text('#chapterConfiguration')
    browser.select('#policy', 'FIFO')
    browser.click('#end')
    assert browser.text('#time') == 't = 6 s', 'La carga propia debe terminar en 6 s con FIFO'
    report['checks'].append('Carga propia ingresada con teclado y ejecutada hasta el final')
    report['stage'] = 'Cerrar el diálogo con Escape'
    browser.tab_to('configBtn')
    browser.key('\ue007')
    browser.key('\ue00c')
    assert not browser.execute("return document.querySelector('dialog').open;")
    assert browser.execute('return document.activeElement.id;') == 'configBtn', 'Escape debe devolver el foco al botón de carga'
    report['checks'].append('Escape cierra el diálogo y restaura el foco')
    report['stage'] = 'Abrir un enlace directo'
    browser.open('?sim=STCF&caso=tardias')
    assert 'Figura 7.5:' in browser.text('#chapterReference')
    report['checks'].append('Enlace directo a STCF con llegadas tardías')


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
        session = browser.request('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'firefox',
            'moz:firefoxOptions': {'binary': args.firefox, 'args': [] if args.headed else ['-headless'], 'prefs': prefs}}}}, session=False)
        browser.session = session['sessionId']
        report['browser'] = session['capabilities']['browserName'] + ' ' + session['capabilities']['browserVersion']
        browser.request('POST', '/timeouts', {'implicit': 2000, 'pageLoad': 15000, 'script': 10000})
        for width in [1280, 360]:
            report['stage'] = 'Preparar pantalla de ' + str(width) + ' px'
            browser.request('POST', '/window/rect', {'width': width, 'height': 1000})
            browser.open()
            viewport = browser.execute('return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};')
            report['viewports'].append(viewport)
            name = f'firefox-{width}-inicio.png'
            browser.screenshot(output/name)
            report['screenshots'].append(name)
            assert viewport['width'] == width, ('Ancho solicitado y real distintos', width, viewport)
            assert viewport['scrollWidth'] <= width, ('Desborde horizontal', viewport)
            check_figures(browser, report)
            check_controls(browser, report)
            for label, selector in [('apunte', '.chapter'), ('simulacion', '.sim')]:
                name = f'firefox-{width}-{label}.png'
                browser.screenshot(output/name, selector)
                report['screenshots'].append(name)
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
