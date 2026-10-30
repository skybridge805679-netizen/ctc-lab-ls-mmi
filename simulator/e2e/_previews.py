"""Screenshots aimed at docs/ go to a temporary folder unless UPDATE_DOCS_PREVIEWS=1.

Browser tests used to rewrite the docs/preview-*.png images on every run, leaving the working tree dirty.
Import this module in a test to keep the committed previews unless they are being refreshed on purpose.
"""
import os
import tempfile
from pathlib import Path
from playwright.sync_api import ElementHandle, Locator, Page
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)

DOCS = (Path(__file__).resolve().parent.parent.parent / 'docs').resolve()
TARGET = Path(tempfile.gettempdir()) / 'ctc-lab-previews'


def _redirect(path):
    if path is None or os.environ.get('UPDATE_DOCS_PREVIEWS') == '1':
        return path
    p = Path(path).resolve()
    if DOCS in p.parents:
        TARGET.mkdir(parents=True, exist_ok=True)
        return str(TARGET / p.name)
    return path


def _wrap(cls):
    original = cls.screenshot

    def screenshot(self, *args, **kwargs):
        if 'path' in kwargs:
            kwargs['path'] = _redirect(kwargs['path'])
        return original(self, *args, **kwargs)
    cls.screenshot = screenshot


for _cls in (Page, Locator, ElementHandle):
    _wrap(_cls)
