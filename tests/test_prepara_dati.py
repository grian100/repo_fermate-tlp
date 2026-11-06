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
    assert {d["fermate"] for d in fonte["dataset"].values()} == {tipi.count("superficie"), tipi.count("metro")}
