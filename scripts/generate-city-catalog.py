#!/usr/bin/env python3
"""Build the municipal city catalog used by the client-side city directory.

Sources:
- China: province-city-china (GB/T 2260), filtered to municipal names ending in 市
  (including municipalities, prefecture-level cities and county-level cities).
- United States: U.S. Census national place gazetteer, excluding census-designated places.
- United Kingdom: the official list of places granted city status.
- France: the French government commune API (communes are the municipal level).
"""

from __future__ import annotations

import csv
import io
import json
import re
import time
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "city-catalog.json"

CHINA_URL = "https://unpkg.com/province-city-china@8.5.8/dist/data.json"
US_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip"
FRANCE_URL = "https://geo.api.gouv.fr/communes?fields=nom,population&format=json&geometry=centre"

UK_CITIES = [
    "Aberdeen", "Armagh", "Bangor", "Bangor (Northern Ireland)", "Bath", "Belfast", "Birmingham", "Bradford",
    "Brighton and Hove", "Bristol", "Cambridge", "Canterbury", "Cardiff", "Carlisle",
    "Chelmsford", "Chester", "Chichester", "City of London", "Colchester", "Coventry",
    "Derby", "Doncaster", "Dundee", "Dunfermline", "Durham", "Edinburgh", "Ely",
    "Exeter", "Glasgow", "Gloucester", "Hereford", "Inverness", "Kingston upon Hull",
    "Lancaster", "Leeds", "Leicester", "Lichfield", "Lincoln", "Lisburn", "Liverpool",
    "Londonderry", "Manchester", "Milton Keynes", "Newcastle upon Tyne", "Newport",
    "Newry", "Norwich", "Nottingham", "Oxford", "Perth", "Peterborough", "Plymouth",
    "Portsmouth", "Preston", "Ripon", "Salford", "Salisbury", "Sheffield", "Southampton",
    "Southend-on-Sea", "St Albans", "St Asaph", "St Davids", "Stirling", "Stoke-on-Trent",
    "Sunderland", "Swansea", "Truro", "Wakefield", "Wells", "Westminster", "Winchester",
    "Wolverhampton", "Worcester", "Wrexham", "York",
]


def read_url(url: str) -> bytes:
    last_error = None
    for attempt in range(3):
        request = urllib.request.Request(url, headers={"User-Agent": "OPC-city-catalog/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return response.read()
        except (OSError, TimeoutError) as error:
            last_error = error
            time.sleep(2**attempt)
    raise RuntimeError(f"Unable to download {url}") from last_error


def china_cities() -> list[dict[str, str]]:
    records = json.loads(read_url(CHINA_URL))
    result = []
    for record in records:
        code = record["code"]
        name = record["name"]
        if name.endswith("市"):
            result.append({"name": name.removesuffix("市"), "en": name.removesuffix("市"), "region": code[:2]})
    return unique(result)


def us_cities() -> list[dict[str, str]]:
    archive = zipfile.ZipFile(io.BytesIO(read_url(US_URL)))
    filename = archive.namelist()[0]
    source = io.TextIOWrapper(archive.open(filename), encoding="utf-8")
    header = source.readline()
    delimiter = "|" if "|" in header else "\t"
    reader = csv.DictReader([header, *source], delimiter=delimiter)
    result = []
    legal_suffix = re.compile(
        r" (city and borough|city and county|consolidated government|metropolitan government|municipality|borough|city|town|village)$",
        re.IGNORECASE,
    )
    for row in reader:
        # FUNCSTAT=A is an active legal/incorporated place. This excludes CDPs,
        # comunidades and other statistical areas that are not municipalities.
        if row["FUNCSTAT"] != "A":
            continue
        display_name = legal_suffix.sub("", row["NAME"]).strip()
        state = row["USPS"]
        result.append({"name": display_name, "en": f"{display_name.upper()} · {state}", "region": state})
    return unique(result, include_region=True)


def uk_cities() -> list[dict[str, str]]:
    return [{"name": name, "en": name.upper(), "region": "UK"} for name in UK_CITIES]


def france_cities() -> list[dict[str, str]]:
    records = json.loads(read_url(FRANCE_URL))
    return unique([
        {"name": record["nom"], "en": f'{record["nom"].upper()} · {record["code"][:2]}', "region": record["code"][:2]}
        for record in records
    ], include_region=True)


def unique(records: list[dict[str, str]], include_region: bool = False) -> list[dict[str, str]]:
    seen: set[str] = set()
    output = []
    for record in records:
        key = f'{record["name"]}|{record["region"]}' if include_region else record["name"]
        if key in seen:
            continue
        seen.add(key)
        output.append(record)
    return output


def main() -> None:
    catalog = {
        "中国": china_cities(),
        "美国": us_cities(),
        "英国": uk_cities(),
        "法国": france_cities(),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Generated", OUTPUT)
    for country, records in catalog.items():
        print(f"  {country}: {len(records):,}")


if __name__ == "__main__":
    main()
