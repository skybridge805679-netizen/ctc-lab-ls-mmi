"""Explicit input for older operational tests; the application itself starts empty."""
import json,subprocess
from functools import lru_cache
from pathlib import Path
@lru_cache(maxsize=1)
def _sample():
 root=Path(__file__).resolve().parents[2]
 return json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./simulator/engine/sample-timetable.test-fixture.cjs')()))"],cwd=root))
def insert_sample_timetable(page):
 result=page.evaluate('t=>SimRemote.command({type:"timetable",method:"import",args:[t]})',_sample())
 assert result['ok'],result
