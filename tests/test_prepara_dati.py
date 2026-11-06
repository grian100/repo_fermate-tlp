import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import prepara_dati  # noqa: E402


def test_dividi_linee():
    assert prepara_dati.dividi_linee("50,64,326,64") == ["50", "64", "326"]
    assert prepara_dati.dividi_linee("90, 91") == ["90", "91"]
    assert prepara_dati.dividi_linee(161) == ["161"]
    assert prepara_dati.dividi_linee("") == []


def test_normalizza():
    geojson = {"features": [
        {"properties": {"id_amat": 1, "ubicazione": "  Via  Roma ", "linee": "2,1"},
         "geometry": {"type": "Point", "coordinates": [9.123456789, 45.987654321]}},
        {"properties": {"id_amat": 2, "ubicazione": "Senza posizione", "linee": "3"}, "geometry": None},
    ]}
    fermate, scartate = prepara_dati.normalizza(geojson, "superficie", "ubicazione")
    assert scartate == 1
    assert fermate == [{"type": "Feature",
                        "properties": {"id": 1, "nome": "Via Roma", "tipo": "superficie", "linee": ["1", "2"]},
                        "geometry": {"type": "Point", "coordinates": [9.123457, 45.987654]}}]


def test_dati_pubblicati():
    dati = json.loads((ROOT / "data" / "fermate.geojson").read_text(encoding="utf-8"))
    fermate = dati["features"]
    tipi = [f["properties"]["tipo"] for f in fermate]
    assert tipi.count("superficie") > 4000 and tipi.count("metro") > 100
    for f in fermate:
        lon, lat = f["geometry"]["coordinates"]
        assert 8.8 < lon < 9.5 and 45.2 < lat < 45.8  # area di Milano
        assert f["properties"]["nome"] and f["properties"]["linee"]
    metro = {l for f in fermate if f["properties"]["tipo"] == "metro" for l in f["properties"]["linee"]}
    assert metro == {"1", "2", "3", "4", "5"}
    fonte = json.loads((ROOT / "data" / "fonte.json").read_text(encoding="utf-8"))
    assert fonte["dataset"]["superficie"]["fermate"] == tipi.count("superficie")
    assert fonte["dataset"]["metro"]["fermate"] == tipi.count("metro")


def test_script_dati_uguale_al_geojson(tmp_path):
    # data/fermate.js (usato dalla pagina) deve contenere gli stessi dati di data/fermate.geojson
    testo = (ROOT / "data" / "fermate.js").read_text(encoding="utf-8")
    righe = dict(r.split(" = ", 1) for r in testo.splitlines() if r.startswith("window."))
    geojson = json.loads((ROOT / "data" / "fermate.geojson").read_text(encoding="utf-8"))
    fonte = json.loads((ROOT / "data" / "fonte.json").read_text(encoding="utf-8"))
    assert json.loads(righe["window.FERMATE"].rstrip(";")) == geojson
    assert json.loads(righe["window.FONTE"].rstrip(";")) == fonte

    prepara_dati.scrivi_script(tmp_path / "x.js", geojson, fonte)
    assert (tmp_path / "x.js").read_text(encoding="utf-8") == testo


def test_municipi():
    municipi = json.loads((ROOT / "data" / "municipi.geojson").read_text(encoding="utf-8"))["features"]
    assert [m["properties"]["municipio"] for m in municipi] == list(range(1, 10))
    # la superficie del Comune di Milano è di circa 182 km²
    assert 180 < sum(m["properties"]["superficie_km2"] for m in municipi) < 183
    assert all(m["geometry"]["type"] == "Polygon" for m in municipi)
