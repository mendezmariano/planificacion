"""Guarda eventos de foco de la prueba de teclado si el recorrido falla."""
import sys
import check_firefox as check


controls = check.check_controls


def observe(browser, report):
    browser.execute("""
      window.b01Events = [];
      for (const type of ['focusin', 'focusout', 'click', 'close', 'cancel', 'keydown', 'keyup']) {
        window.addEventListener(type, e => {
          const target = e.target.id || e.target.tagName;
          window.b01Events.push([e.type, target, e.key, document.hasFocus(), document.querySelector('dialog').open]);
          if (window.b01Events.length > 32) window.b01Events.shift();
        }, true);
      }
    """)
    try:
        controls(browser, report)
    except Exception:
        report['browser_events'] = browser.execute('return window.b01Events;')
        raise


check.check_controls = observe
sys.exit(check.main())
