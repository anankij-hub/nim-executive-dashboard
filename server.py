#!/usr/bin/env python3
from __future__ import annotations

import json
import csv
import math
import os
import re
import subprocess
import sys
import zipfile
from datetime import datetime
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "input"
DATA_DIR = BASE_DIR / "data"
ARCHIVE_DIR = INPUT_DIR / "_archives"
INPUT_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
ARCHIVE_DIR.mkdir(exist_ok=True)

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
READ_ONLY_DEPLOY = os.environ.get("READ_ONLY_DEPLOY", "0").lower() in {"1", "true", "yes"}
ALLOWED = {".xlsx", ".xls", ".csv", ".zip"}
EXTRACTABLE = {".xlsx", ".xls", ".csv"}
MAX_UPLOAD = 750 * 1024 * 1024
MAX_ZIP_UNCOMPRESSED = 1_500 * 1024 * 1024
MAX_ZIP_FILES = 500
REGISTRY_PATH = DATA_DIR / "source_registry.json"
PROCESSOR_VERSION = "wasted-cost-7"

CATEGORY_LABELS = {
    "prepared": "Prepared Dataset",
    "cm": "Contribution Margin (CM)",
    "revenue": "Revenue / Bill",
    "trip": "Trip Expense",
    "fuel": "Fuel",
    "maintenance": "Maintenance",
    "rental": "Vehicle Rental",
    "vehicle_master": "Vehicle Master",
    "route_master": "Route Master",
    "receivables": "Receivables",
    "other": "Other",
    "customer": "Customer Profitability",
    "trip": "Trip-level Operations",
}

TRIP_WORKBOOK_NAME = "สรุปเที่ยว 68 ของจริง.xlsx"
TRIP_REQUIRED_COLUMNS = {
    "เที่ยว", "น้ำหนักรวมที่บรรทุก(กิโลกรัม)", "ต้น-ปลาย", "ต้นทาง", "ปลายทาง",
    "Flag เหนือ-กทม", "ชนิดรถ", "ทะเบียน", "Load Factor ที่ใช้จริง", "สถานะข้อมูล",
    "รายได้", "ต้นทุน", "กำไร", "สถานะกำไร/ขาดทุน", "% Load Factor จุดคุ้มทุน",
    "สถานะเทียบจุดคุ้มทุน", "ต้นทุนสูญเปล่า factor",
}

CUSTOMER_REQUIRED_COLUMNS = {
    "Customer_Code",
    "Allocated_Profit",
    "Allocated_Profit_Margin_%",
    "Sum of ราคารวม",
    "Total_Allocated_Cost",
    "Customer_Strategy_Segment",
}
CUSTOMER_STATUS_THRESHOLDS = {"highly_profitable": 20, "profitable": 0, "watch": -20}
CUSTOMER_PRIORITY_CONFIG = {
    "weights": {"profit_leakage": 0.50, "revenue_at_risk": 0.30, "margin_severity": 0.20},
    "actions": {"high": 67, "medium": 34},
    "default_queue_limit": 50,
    "available_queue_limits": [25, 50, 100],
}

def load_registry():
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8")) if REGISTRY_PATH.exists() else {}
    except Exception:
        return {}

def save_registry(reg):
    REGISTRY_PATH.write_text(json.dumps(reg, ensure_ascii=False, indent=2), encoding="utf-8")

def classify_name(name: str) -> str:
    n = name.lower()
    if "contribution margin" in n or n.startswith("cm"):
        return "cm"
    if "pq" in n or "prepared" in n or "update-รวม" in n or "update_รวม" in n:
        return "prepared"
    if "ลูกหนี้" in n or "รับชำระ" in n or "receivable" in n or "payment" in n:
        return "receivables"
    if "ความจุรถ" in n or "vehicle master" in n or "vehicle_master" in n:
        return "vehicle_master"
    if "ระยะทาง" in n or "route master" in n or "route_master" in n:
        return "route_master"
    if "ซ่อม" in n or "maintenance" in n or "repair" in n:
        return "maintenance"
    if "เช่ารถ" in n or "รถร่วม" in n or "rental" in n:
        return "rental"
    if "น้ำมัน" in n or "fuel" in n:
        return "fuel"
    if "สรุปเที่ยว" in n or "ค่าเดินทาง" in n or "travel" in n or "trip" in n:
        return "trip"
    if "รายได้" in n or "บิล" in n or "revenue" in n or "invoice" in n:
        return "revenue"
    if "ลูกค้า" in n or "customer" in n or "client" in n:
        return "customer"
    return "other"

def category_for(path: Path) -> str:
    rel = str(path.relative_to(INPUT_DIR))
    reg = load_registry()
    item = reg.get(rel, {})
    cat = item.get("category")
    if cat in (None, "prepared", "cm") and classify_name(path.name) == "cm":
        return "cm"
    return cat if cat in CATEGORY_LABELS else classify_name(path.name)


def unique_path(folder: Path, name: str) -> Path:
    safe = Path(name).name.strip() or "uploaded_file"
    target = folder / safe
    if not target.exists():
        return target
    stem, suffix = target.stem, target.suffix
    i = 2
    while True:
        candidate = folder / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def human_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 ** 2:
        return f"{size/1024:.1f} KB"
    if size < 1024 ** 3:
        return f"{size/1024/1024:.1f} MB"
    return f"{size/1024/1024/1024:.2f} GB"


def input_files():
    items = []
    active = {str(p.relative_to(INPUT_DIR)) for _, p in prepared_files()}
    customer_path = customer_source()
    trip_path = trip_source()
    if customer_path:
        active.add(str(customer_path.relative_to(INPUT_DIR)))
    for p in trip_sources().values():
        active.add(str(p.relative_to(INPUT_DIR)))
    for p in sorted(INPUT_DIR.rglob("*"), key=lambda x: str(x).lower()):
        if not p.is_file() or p.name.startswith(".") or p.suffix.lower() not in EXTRACTABLE:
            continue
        stat = p.stat()
        rel = str(p.relative_to(INPUT_DIR))
        cat = "customer" if customer_path and p == customer_path else "trip" if trip_path and p == trip_path else category_for(p)
        items.append({
            "name": rel,
            "category": cat,
            "category_label": CATEGORY_LABELS.get(cat, cat),
            "year": extract_year(p.stem),
            "used_in_dashboard": rel in active,
            "size": stat.st_size,
            "size_human": human_size(stat.st_size),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })
    return items


def extract_zip(zip_path: Path):
    extracted = []
    with zipfile.ZipFile(zip_path) as zf:
        members = [m for m in zf.infolist() if not m.is_dir()]
        if len(members) > MAX_ZIP_FILES:
            raise ValueError(f"ZIP มีไฟล์มากเกินไป ({len(members)} ไฟล์)")
        total = sum(m.file_size for m in members)
        if total > MAX_ZIP_UNCOMPRESSED:
            raise ValueError("ZIP มีขนาดหลังแตกไฟล์ใหญ่เกินขีดจำกัด")
        for m in members:
            member_name = Path(m.filename).name
            if not member_name or member_name.startswith(".") or "__MACOSX" in m.filename:
                continue
            if Path(member_name).suffix.lower() not in EXTRACTABLE:
                continue
            target = unique_path(INPUT_DIR, member_name)
            with zf.open(m) as src, target.open("wb") as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)
            extracted.append(target.name)
    return extracted


def num(v):
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def extract_year(name: str):
    # PQ67-update / PQ2567 / ...
    m = re.search(r"(?:PQ\s*)?(25)?(6[5-9]|7[0-9])", name, re.I)
    if not m:
        return None
    short = int(m.group(2))
    return 2500 + short


def prepared_files():
    out = []
    for p in INPUT_DIR.rglob("*"):
        if not p.is_file() or p.suffix.lower() != ".xlsx":
            continue
        if category_for(p) not in ("prepared", "cm"):
            continue
        y = extract_year(p.stem)
        if y:
            out.append((y, p))
    # หากมีหลายไฟล์ในปีเดียวกัน ใช้ไฟล์ที่แก้ไขล่าสุด
    latest = {}
    for y, p in sorted(out, key=lambda yp: (category_for(yp[1]) == "cm", yp[1].stat().st_mtime)):
        latest[y] = p
    return sorted(latest.items())


def customer_source():
    for path in sorted(INPUT_DIR.rglob("*.csv"), key=lambda p: str(p).lower()):
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                if reader.fieldnames and CUSTOMER_REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
                    return path
        except (OSError, UnicodeDecodeError, csv.Error):
            continue
    return None

# backward-compatible internal alias
def pq_files():
    return prepared_files()


def find_sheet(wb, contains):
    needles = [x.lower() for x in contains]
    for s in wb.sheetnames:
        sl = s.lower().strip()
        if all(n in sl for n in needles):
            return wb[s]
    return None


def rows_values(ws):
    if ws is None:
        return []
    return [tuple(r) for r in ws.iter_rows(values_only=True)]


def find_header(rows, required):
    required = [r.lower() for r in required]
    for i, row in enumerate(rows):
        vals = [str(x).strip().lower() if x is not None else "" for x in row]
        if all(any(r == v or r in v for v in vals) for r in required):
            return i, vals
    return None, None


def parse_overview(wb):
    ws = find_sheet(wb, ["ภาพรวม"])
    rows = rows_values(ws)
    hidx, headers = find_header(rows, ["row labels", "รายได้"])
    if hidx is None:
        return {"monthly": [], "totals": {}}
    col = {h: i for i, h in enumerate(headers) if h}
    def ci(*names):
        for n in names:
            n = n.lower()
            for h, i in col.items():
                if n == h or n in h:
                    return i
        return None
    label_i = ci("row labels")
    rev_i = ci("รายได้")
    travel_i = ci("ต้นทุนค่าเดินทาง", "ต้นทุน")
    fuel_i = ci("ค่าน้ำมัน")
    repair_i = ci("ค่าซ่อม")
    rent_i = ci("ค่าเช่ารถ")
    monthly = []
    totals = {}
    for row in rows[hidx+1:]:
        label = str(row[label_i]).strip() if label_i is not None and label_i < len(row) and row[label_i] is not None else ""
        if not label:
            continue
        vals = {
            "revenue": num(row[rev_i]) if rev_i is not None and rev_i < len(row) else 0,
            "travel": num(row[travel_i]) if travel_i is not None and travel_i < len(row) else 0,
            "fuel": num(row[fuel_i]) if fuel_i is not None and fuel_i < len(row) else 0,
            "repair": num(row[repair_i]) if repair_i is not None and repair_i < len(row) else 0,
            "rental": num(row[rent_i]) if rent_i is not None and rent_i < len(row) else 0,
        }
        vals["all_costs"] = vals["travel"] + vals["fuel"] + vals["repair"] + vals["rental"]
        vals["operating_surplus"] = vals["revenue"] - vals["all_costs"]
        if "grand total" in label.lower() or "รวม" == label.lower():
            totals = vals
        else:
            monthly.append({"month": label, **vals})
    if not totals and monthly:
        keys = ["revenue","travel","fuel","repair","rental","all_costs","operating_surplus"]
        totals = {k: sum(x[k] for x in monthly) for k in keys}
    return {"monthly": monthly, "totals": totals}


def parse_service_profit(wb):
    # 1) Prefer a fully prepared service-profit table when available.
    ws = find_sheet(wb, ["กำไร", "กลุ่มบริการ"])
    rows = rows_values(ws)
    hidx, headers = find_header(rows, ["กลุ่มบริการ", "รายได้"])
    if hidx is not None:
        col = {h: i for i, h in enumerate(headers) if h}
        def ix(part):
            p = part.lower()
            for h, i in col.items():
                if p == h or p in h:
                    return i
            return None
        idx = {k: ix(v) for k, v in {
            "service": "กลุ่มบริการ", "revenue": "รายได้", "cost": "ต้นทุนรวม",
            "profit": "กำไร", "margin": "อัตรากำไร"
        }.items()}
        groups = []; total = {}
        for row in rows[hidx + 1:]:
            if idx["service"] is None or idx["service"] >= len(row):
                continue
            service = str(row[idx["service"]]).strip() if row[idx["service"]] is not None else ""
            if not service:
                continue
            rec = {
                "service": service,
                "revenue": num(row[idx["revenue"]]) if idx["revenue"] is not None and idx["revenue"] < len(row) else 0,
                "cost": num(row[idx["cost"]]) if idx["cost"] is not None and idx["cost"] < len(row) else 0,
                "profit": num(row[idx["profit"]]) if idx["profit"] is not None and idx["profit"] < len(row) else 0,
            }
            mv = row[idx["margin"]] if idx["margin"] is not None and idx["margin"] < len(row) else None
            rec["margin"] = num(mv) * 100 if isinstance(mv, (int, float)) and abs(num(mv)) <= 1.5 else num(mv)
            if "รวม" in service:
                total = rec
            else:
                groups.append(rec)
        return {"groups": groups, "total": total, "basis": "ตามตารางกำไร/ต้นทุนกลุ่มบริการใน Prepared Dataset"}

    # 2) Fallback: aggregate the service-group pivot that contains Revenue and Rental.
    # This supports files whose sheet is named e.g. "กลุ่มบริการ (ของย่อย)".
    ws = find_sheet(wb, ["กลุ่มบริการ"])
    rows = rows_values(ws)
    hidx, headers = find_header(rows, ["row labels", "รายได้"])
    if hidx is None:
        hidx, headers = find_header(rows, ["กลุ่มบริการ", "รายได้"])
    if hidx is None:
        return {"groups": [], "total": {}, "basis": "ไม่มีข้อมูลกลุ่มบริการที่อ่านได้"}

    def findcol(part):
        p = part.lower()
        for i, h in enumerate(headers):
            hl = (h or "").strip().lower()
            if p == hl or p in hl:
                return i
        return None
    li = findcol("row labels")
    if li is None:
        li = findcol("กลุ่มบริการ")
    ri = findcol("รายได้")
    rent_i = findcol("ค่าเช่ารถ")
    if li is None or ri is None:
        return {"groups": [], "total": {}, "basis": "ไม่มีข้อมูลกลุ่มบริการที่อ่านได้"}

    agg = {}
    for row in rows[hidx + 1:]:
        if li >= len(row):
            continue
        label = str(row[li]).strip() if row[li] not in (None, "") else ""
        if not label:
            continue
        revenue = num(row[ri]) if ri < len(row) else 0
        rental = num(row[rent_i]) if rent_i is not None and rent_i < len(row) else 0
        # Month headers have no amount and are skipped; service rows contain revenue.
        if revenue == 0 and rental == 0:
            continue
        ll = label.lower()
        if "grand total" in ll or label in ("รวม", "รวมทั้งหมด", "ผลรวมทั้งหมด"):
            continue
        rec = agg.setdefault(label, {"service": label, "revenue": 0.0, "cost": 0.0, "profit": 0.0, "margin": 0.0})
        rec["revenue"] += revenue
        rec["cost"] += rental
    groups = []
    for rec in agg.values():
        rec["profit"] = rec["revenue"] - rec["cost"]
        rec["margin"] = rec["profit"] / rec["revenue"] * 100 if rec["revenue"] else 0
        groups.append(rec)
    total_revenue = sum(x["revenue"] for x in groups)
    total_cost = sum(x["cost"] for x in groups)
    total = {
        "service": "รวม", "revenue": total_revenue, "cost": total_cost,
        "profit": total_revenue - total_cost,
        "margin": ((total_revenue - total_cost) / total_revenue * 100 if total_revenue else 0)
    }
    return {"groups": groups, "total": total, "basis": "รายได้ - ค่าเช่ารถ (ข้อมูลกลุ่มบริการที่มีอยู่ใน Prepared Dataset)"}


def parse_metric_sheet(wb, keywords, metric_name):
    """Read a vehicle-level pivot/summary sheet.

    Supports both Excel pivot headers such as "Row Labels" and cleaned
    tables whose first field is simply "ชนิดรถ".
    """
    ws = find_sheet(wb, keywords)
    rows = rows_values(ws)
    if not rows:
        return {}

    hidx = None
    headers = None
    for required in (["ชนิดรถ"], ["row labels"]):
        hidx, headers = find_header(rows, required)
        if hidx is not None:
            break
    if hidx is None:
        return {}

    label_i = None
    metric_i = None
    for i, h in enumerate(headers):
        hl = (h or "").strip().lower()
        if "ชนิดรถ" in hl or "row labels" in hl:
            label_i = i
        elif hl and metric_i is None:
            metric_i = i
    if label_i is None or metric_i is None:
        return {}

    out = {}
    for row in rows[hidx + 1:]:
        if label_i >= len(row):
            continue
        label = str(row[label_i]).strip() if row[label_i] is not None else ""
        ll = label.lower()
        if not label or "grand total" in ll or label in ("รวมทั้งหมด", "รวม"):
            continue
        out[label] = num(row[metric_i]) if metric_i < len(row) else 0
    return out


def _find_sheet_by_headers(wb, required_headers):
    """Find the first worksheet containing a row with all required headers."""
    for sname in wb.sheetnames:
        ws = wb[sname]
        rows = rows_values(ws)
        hidx, headers = find_header(rows, required_headers)
        if hidx is not None:
            return ws, rows, hidx, headers
    return None, [], None, None


def parse_vehicle_revenue_from_detail(wb):
    """Derive revenue by vehicle type from detail data.

    This is more reliable than some vehicle-revenue pivot sheets (e.g. a
    pivot that repeats the grand total for every vehicle). It joins the
    revenue detail on Manifest Number to the manifest/vehicle mapping sheet.
    Blank manifest cells in the detail are treated as continuation rows of
    the previous manifest, matching the visual grouping in the PQ output.
    """
    # Revenue detail: usually sheet "รวม" with Manifest + Revenue.
    detail_ws = find_sheet(wb, ["รวม"])
    detail_rows = rows_values(detail_ws)
    hidx, headers = find_header(detail_rows, ["เลขที่ใบรายการ", "รายได้"])
    if hidx is None:
        return {}

    def find_col(headers, needle):
        n = needle.lower()
        for i, h in enumerate(headers):
            hl = (h or "").strip().lower()
            if n == hl or n in hl:
                return i
        return None

    manifest_i = find_col(headers, "เลขที่ใบรายการ")
    revenue_i = find_col(headers, "รายได้")
    if manifest_i is None or revenue_i is None:
        return {}

    # Mapping sheet may be named differently by year. Search by its columns.
    map_ws, map_rows, mhidx, mheaders = _find_sheet_by_headers(
        wb, ["เลขที่ใบรายการ", "ชนิดรถ"]
    )
    if mhidx is None:
        return {}
    m_manifest_i = find_col(mheaders, "เลขที่ใบรายการ")
    m_vehicle_i = find_col(mheaders, "ชนิดรถ")
    if m_manifest_i is None or m_vehicle_i is None:
        return {}

    manifest_to_vehicle = {}
    for row in map_rows[mhidx + 1:]:
        if m_manifest_i >= len(row) or m_vehicle_i >= len(row):
            continue
        manifest = str(row[m_manifest_i]).strip() if row[m_manifest_i] not in (None, "") else ""
        vehicle = str(row[m_vehicle_i]).strip() if row[m_vehicle_i] not in (None, "") else ""
        if not manifest or not vehicle:
            continue
        # Ignore obvious malformed tokens, but otherwise preserve source value.
        if len(manifest) < 5:
            continue
        manifest_to_vehicle[manifest] = vehicle

    out = {}
    current_manifest = ""
    for row in detail_rows[hidx + 1:]:
        if manifest_i < len(row) and row[manifest_i] not in (None, ""):
            candidate = str(row[manifest_i]).strip()
            cl = candidate.lower()
            # Pivot grand-total rows repeat the full-year revenue and must not
            # be treated as another trip.
            if "grand total" in cl or "ผลรวมทั้งหมด" in candidate or candidate in ("รวม", "รวมทั้งหมด"):
                continue
            if candidate:
                current_manifest = candidate
        if not current_manifest:
            continue
        revenue = num(row[revenue_i]) if revenue_i < len(row) else 0
        if not revenue:
            continue
        vehicle = manifest_to_vehicle.get(current_manifest, "ยังไม่ได้ระบุ")
        out[vehicle] = out.get(vehicle, 0) + revenue
    return out


def parse_vehicles(wb):
    # Prefer a manifest-level join for revenue. It works across PQ67/68/69 and
    # avoids a known PQ68 pivot issue where the grand total is repeated for
    # every vehicle type. Fall back to the vehicle revenue sheet if needed.
    revenue = parse_vehicle_revenue_from_detail(wb)
    if not revenue:
        revenue = parse_metric_sheet(wb, ["ชนิดรถ", "รายได้"], "revenue")

    metrics = {
        "revenue": revenue,
        "travel": parse_metric_sheet(wb, ["ชนิดรถ", "ต้นทุน"], "travel"),
        "fuel": parse_metric_sheet(wb, ["ชนิดรถ", "ค่าน้ำมัน"], "fuel"),
        "repair": parse_metric_sheet(wb, ["ชนิดรถ", "ค่าซ่อม"], "repair"),
        "rental": parse_metric_sheet(wb, ["ชนิดรถ", "ค่าเช่า"], "rental"),
    }
    names = sorted(set().union(*[set(v.keys()) for v in metrics.values()])) if metrics else []
    out = []
    for name in names:
        rec = {"vehicle": name}
        for k, d in metrics.items():
            rec[k] = d.get(name, 0)
        rec["known_cost"] = rec["travel"] + rec["fuel"] + rec["rental"] + rec["repair"]
        rec["contribution_before_repair"] = rec["revenue"] - rec["travel"] - rec["fuel"] - rec["rental"]
        rec["contribution_after_repair"] = rec["revenue"] - rec["known_cost"]
        out.append(rec)
    return out

def parse_routes(wb):
    ws=find_sheet(wb,["จุดขึ้น","ลง"])
    rows=rows_values(ws)
    hidx,headers=find_header(rows,["ต้นทาง","ปลายทาง","รายได้"])
    if hidx is None: return []
    def findcol(part):
        p=part.lower()
        for i,h in enumerate(headers):
            if p==h or p in h: return i
        return None
    oi,di,ri,ti,li = [findcol(x) for x in ["ต้นทาง","ปลายทาง","รายได้","ต้นทุนค่าเดินทาง","ค่าเช่ารถ"]]
    current_origin=""; agg={}
    for row in rows[hidx+1:]:
        if oi is not None and oi<len(row) and row[oi] not in (None,""):
            current_origin=str(row[oi]).strip()
        dest=str(row[di]).strip() if di is not None and di<len(row) and row[di] not in (None,"") else ""
        if not current_origin or not dest or "grand total" in dest.lower(): continue
        key=(current_origin,dest)
        rec=agg.setdefault(key,{"origin":current_origin,"destination":dest,"revenue":0,"travel":0,"rental":0})
        rec["revenue"] += num(row[ri]) if ri is not None and ri<len(row) else 0
        rec["travel"] += num(row[ti]) if ti is not None and ti<len(row) else 0
        rec["rental"] += num(row[li]) if li is not None and li<len(row) else 0
    out=[]
    for rec in agg.values():
        rec["known_cost"] = rec["travel"]+rec["rental"]
        rec["contribution"] = rec["revenue"]-rec["known_cost"]
        rec["route"] = f'{rec["origin"]} → {rec["destination"]}'
        out.append(rec)
    return out


def build_year_data(year, path):
    try:
        from openpyxl import load_workbook
    except ImportError as e:
        raise RuntimeError("ต้องติดตั้ง openpyxl ใน .venv: python -m pip install openpyxl") from e
    wb=load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        if "CM" in wb.sheetnames or any(f"ไตรมาสที่{i}" in wb.sheetnames for i in range(1, 5)):
            from cm_data import parse_cm
            result = parse_cm(wb, year, str(path.relative_to(INPUT_DIR)))
            supplemental = sorted((p for p in INPUT_DIR.rglob("*.xlsx") if p != path and category_for(p) == "prepared" and extract_year(p.stem) == year), key=lambda p: p.stat().st_mtime, reverse=True)
            for service_path in supplemental:
                service_wb = load_workbook(service_path, read_only=True, data_only=True, keep_links=False)
                try:
                    service = parse_service_profit(service_wb)
                finally:
                    service_wb.close()
                if service.get("groups"):
                    result.update(service_groups=service["groups"], service_basis=service.get("basis", ""), service_source=str(service_path.relative_to(INPUT_DIR)))
                    break
            return result
        if category_for(path) == "cm":
            raise ValueError("ไม่พบชีท CM")
        overview=parse_overview(wb)
        service=parse_service_profit(wb)
        vehicles=parse_vehicles(wb)
        routes=parse_routes(wb)
        # Use a full service-profit table only when its basis explicitly says so.
        total = service.get("total") if "ตารางกำไร/ต้นทุน" in service.get("basis", "") else {}
        if not total:
            ot=overview.get("totals",{})
            revenue=ot.get("revenue",0); cost=ot.get("all_costs",0); profit=revenue-cost
            total={"revenue":revenue,"cost":cost,"profit":profit,"margin":(profit/revenue*100 if revenue else 0)}
        return {
            "year":year,
            "source":str(path.relative_to(INPUT_DIR)),
            "overview":overview,
            "profit_summary":total,
            "service_groups":service.get("groups",[]),
            "service_basis":service.get("basis", ""),
            "vehicles":vehicles,
            "routes":routes,
        }
    finally:
        wb.close()


def customer_number(value, percent=False):
    if value is None or str(value).strip() == "":
        return None
    text = str(value).strip().replace(",", "")
    if percent:
        text = text.replace("%", "")
    try:
        parsed = float(text)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def percentile_value(values, fraction):
    ordered = sorted(v for v in values if v is not None and math.isfinite(v))
    if not ordered:
        return None
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def percentile_scores(rows, value_key):
    values = sorted(row[value_key] for row in rows if row.get(value_key) is not None)
    if not values:
        return {}
    scores = {}
    for row in rows:
        value = row.get(value_key)
        if value is None:
            scores[row["customer"]] = None
            continue
        positions = [i + 1 for i, candidate in enumerate(values) if candidate == value]
        scores[row["customer"]] = sum(positions) / len(positions) / len(values) * 100
    return scores


def customer_status(margin):
    if margin is None:
        return "N/A"
    if margin > CUSTOMER_STATUS_THRESHOLDS["highly_profitable"]:
        return "Highly Profitable"
    if margin > CUSTOMER_STATUS_THRESHOLDS["profitable"]:
        return "Profitable"
    if margin >= CUSTOMER_STATUS_THRESHOLDS["watch"]:
        return "Watch"
    return "Loss Making"


def complete_sum(rows, key):
    values = [row.get(key) for row in rows]
    return sum(values) if values and all(value is not None for value in values) else None


def build_customer_summary():
    path = customer_source()
    if path is None:
        return {
            "ok": False,
            "source": None,
            "rows": [],
            "totals": {},
            "errors": ["ไม่พบไฟล์ลูกค้าที่มีคอลัมน์ตาม schema ที่กำหนด"],
        }

    rows = []
    errors = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for source_row_number, source in enumerate(reader, start=2):
            customer = (source.get("Customer_Code") or "").strip()
            if not customer:
                errors.append(f"แถว {source_row_number}: Customer_Code หายไป")
                continue
            revenue = customer_number(source.get("Sum of ราคารวม"))
            cost = customer_number(source.get("Total_Allocated_Cost"))
            row = {
                "customer": customer,
                "revenue": revenue,
                "allocated_cost": cost,
                "source_allocated_profit": customer_number(source.get("Allocated_Profit")),
                "source_margin_pct": customer_number(source.get("Allocated_Profit_Margin_%"), percent=True),
                "strategy_segment": (source.get("Customer_Strategy_Segment") or "").strip() or None,
            }
            row["contribution"] = revenue - cost if revenue is not None and cost is not None else None
            row["margin_pct"] = row["contribution"] / revenue * 100 if row["contribution"] is not None and revenue not in (None, 0) else None
            row["return_on_cost_pct"] = row["contribution"] / cost * 100 if row["contribution"] is not None and cost not in (None, 0) else None
            row["profit_leakage"] = abs(row["contribution"]) if row["contribution"] is not None and row["contribution"] < 0 else (0 if row["contribution"] is not None else None)
            row["revenue_at_risk"] = revenue if row["contribution"] is not None and row["contribution"] < 0 else (0 if row["contribution"] is not None else None)
            row["profitability_status"] = customer_status(row["margin_pct"])
            row["strategic_action"] = None
            rows.append(row)

    duplicate_codes = sorted({row["customer"] for row in rows if sum(x["customer"] == row["customer"] for x in rows) > 1})
    if duplicate_codes:
        errors.append(f"Customer_Code ซ้ำ: {', '.join(duplicate_codes)}")

    profitable = [row for row in rows if row["contribution"] is not None and row["contribution"] > 0]
    revenue_p75 = percentile_value([row["revenue"] for row in profitable], 0.75)
    margin_p75 = percentile_value([row["margin_pct"] for row in profitable], 0.75)
    for row in profitable:
        high_revenue = revenue_p75 is not None and row["revenue"] >= revenue_p75
        high_margin = margin_p75 is not None and row["margin_pct"] >= margin_p75
        row["strategic_action"] = "PROTECT" if high_revenue else ("GROW" if high_margin else None)

    eligible = [row.copy() for row in rows if row["contribution"] is not None and row["contribution"] < 0]
    leakage_scores = percentile_scores(eligible, "profit_leakage")
    revenue_risk_scores = percentile_scores(eligible, "revenue_at_risk")
    for row in eligible:
        row["margin_severity"] = abs(row["margin_pct"]) if row["margin_pct"] is not None else None
    severity_scores = percentile_scores(eligible, "margin_severity")
    for row in eligible:
        row["profit_leakage_score"] = leakage_scores.get(row["customer"])
        row["revenue_at_risk_score"] = revenue_risk_scores.get(row["customer"])
        row["margin_severity_score"] = severity_scores.get(row["customer"])
        components = [row["profit_leakage_score"], row["revenue_at_risk_score"], row["margin_severity_score"]]
        row["management_priority_score"] = (
            CUSTOMER_PRIORITY_CONFIG["weights"]["profit_leakage"] * components[0]
            + CUSTOMER_PRIORITY_CONFIG["weights"]["revenue_at_risk"] * components[1]
            + CUSTOMER_PRIORITY_CONFIG["weights"]["margin_severity"] * components[2]
            if all(value is not None for value in components) else None
        )
        score = row["management_priority_score"]
        row["management_action"] = (
            "FIX / RENEGOTIATE" if score is not None and score >= CUSTOMER_PRIORITY_CONFIG["actions"]["high"]
            else "REVIEW" if score is not None and score >= CUSTOMER_PRIORITY_CONFIG["actions"]["medium"]
            else "MONITOR" if score is not None else None
        )
    eligible.sort(key=lambda row: (row["management_priority_score"] is None, -(row["management_priority_score"] or 0), row["customer"]))
    for rank, row in enumerate(eligible, start=1):
        row["priority_rank"] = rank

    median_revenue = percentile_value([row["revenue"] for row in rows], 0.5)
    matrix_rows = []
    for row in rows:
        if row["revenue"] is None or row["margin_pct"] is None:
            row["matrix_quadrant"] = None
            continue
        high_revenue = median_revenue is not None and row["revenue"] > median_revenue
        positive_margin = row["margin_pct"] > 0
        row["matrix_quadrant"] = (
            "key_profit_generator" if high_revenue and positive_margin else
            "growth_opportunity" if not high_revenue and positive_margin else
            "margin_leakage" if high_revenue else "review_renegotiate"
        )
        matrix_rows.append(row)

    matrix = {}
    for key in ("key_profit_generator", "growth_opportunity", "margin_leakage", "review_renegotiate"):
        grouped = [row for row in matrix_rows if row["matrix_quadrant"] == key]
        matrix[key] = {
            "customer_count": len(grouped),
            "revenue": complete_sum(grouped, "revenue"),
            "contribution": complete_sum(grouped, "contribution"),
            "customer_share_pct": len(grouped) / len(rows) * 100 if rows else None,
        }

    totals = {
        "customer_count": len(rows),
        "revenue": complete_sum(rows, "revenue"),
        "allocated_cost": complete_sum(rows, "allocated_cost"),
        "contribution": complete_sum(rows, "contribution"),
        "margin_pct": None,
        "profit_leakage": complete_sum(rows, "profit_leakage"),
        "revenue_at_risk": complete_sum(rows, "revenue_at_risk"),
        "loss_making_count": len(eligible),
    }
    if totals["revenue"] not in (None, 0) and totals["contribution"] is not None:
        totals["margin_pct"] = totals["contribution"] / totals["revenue"] * 100

    top_contributors = sorted(
        [row for row in rows if row["contribution"] is not None and row["contribution"] > 0],
        key=lambda row: (-row["contribution"], row["customer"]),
    )[:10]
    leakage = sorted(eligible, key=lambda row: (-row["profit_leakage"], row["customer"]))[:10]
    strategy_segments = {}
    for row in rows:
        segment = row["strategy_segment"] or "N/A"
        strategy_segments[segment] = strategy_segments.get(segment, 0) + 1
    status_counts = {}
    for row in rows:
        status_counts[row["profitability_status"]] = status_counts.get(row["profitability_status"], 0) + 1

    return {
        "ok": not errors,
        "source": str(path.relative_to(INPUT_DIR)),
        "row_count": len(rows),
        "duplicate_customer_codes": duplicate_codes,
        "missing_fields": {key: sum(row.get(key) is None for row in rows) for key in ("customer", "revenue", "allocated_cost", "contribution", "margin_pct", "strategy_segment")},
        "thresholds": {"status": CUSTOMER_STATUS_THRESHOLDS, "protect_revenue_p75": revenue_p75, "grow_margin_p75": margin_p75, "matrix_revenue_median": median_revenue, "matrix_margin_break_even": 0},
        "priority_config": CUSTOMER_PRIORITY_CONFIG,
        "totals": totals,
        "status_counts": status_counts,
        "strategy_segments": strategy_segments,
        "rows": rows,
        "priority_queue": eligible,
        "top_contributors": top_contributors,
        "largest_leakage": leakage,
        "matrix": matrix,
        "errors": errors,
    }


TRIP_ALIASES = {"เลขที่ใบรายการ": "เที่ยว", "น้ำหนักรวมที่บรรทุก": "น้ำหนักรวมที่บรรทุก(กิโลกรัม)", "ปริมาตรรวมที่บรรทุก": "ปริมาตรรวมที่บรรทุก(CBM)", "ทะเบียนรถ": "ทะเบียน"}


def read_trip_frame(path, nrows=None):
    for sheet in ("ข้อมูลรวม", "รวม"):
        try:
            frame = pd.read_excel(path, sheet_name=sheet, nrows=nrows, dtype=object)
            frame.columns = [TRIP_ALIASES.get(str(c).strip(), str(c).strip()) for c in frame.columns]
            required = TRIP_REQUIRED_COLUMNS | {"ปริมาตรรวมที่บรรทุก(CBM)", "ความจุน้ำหนักสูงสุด", "ความจุปริมาตรสูงสุด"}
            if required.issubset(frame.columns):
                frame.attrs["source_sheet"] = sheet
                return frame
        except ValueError:
            continue
    raise ValueError("ไม่พบชีทข้อมูลเที่ยวที่มีคอลัมน์ครบ")


def trip_sources():
    selected = {}
    for path in sorted(INPUT_DIR.rglob("*.xlsx"), key=lambda p: p.stat().st_mtime):
        if "สรุปเที่ยว" not in path.name and category_for(path) != "trip":
            continue
        year = extract_year(path.stem)
        if not year:
            continue
        try:
            read_trip_frame(path, nrows=0)
            selected[year] = path
        except Exception:
            continue
    return selected


def trip_source():
    sources = trip_sources()
    return sources[max(sources)] if sources else None


def trip_num(series):
    return pd.to_numeric(series, errors="coerce")


def trip_text(series):
    return series.where(series.notna(), "").astype(str).str.replace(r"\s+", " ", regex=True).str.strip()


def trip_json_number(value):
    if value is None or pd.isna(value):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def wasted_cost_metrics(records):
    valid = [r for r in records if r.get("wasted_cost") is not None]
    total = math.fsum(r["wasted_cost"] for r in valid) if valid else None
    positive = sum(r["wasted_cost"] > 0 for r in valid)
    return {"wasted_cost_total": total, "wasted_cost_per_trip": total / len(valid) if valid else None,
            "wasted_cost_valid_trips": len(valid), "wasted_cost_positive_trips": positive,
            "wasted_cost_positive_pct": positive / len(valid) * 100 if valid else None,
            "wasted_cost_missing_trips": len(records) - len(valid)}


def build_trip_summary(path=None):
    path = path or trip_source()
    if path is None:
        return {"ok": False, "source": None, "errors": ["ไม่พบ workbook ข้อมูลเที่ยวที่ผ่าน schema"], "rows": [], "routes": [], "fleet": {}}
    try:
        raw = read_trip_frame(path)
    except Exception as exc:
        return {"ok": False, "source": str(path.relative_to(INPUT_DIR)), "errors": [str(exc)], "rows": [], "routes": [], "fleet": {}}

    source_sheet = raw.attrs.get("source_sheet", "ข้อมูลรวม")
    raw = raw.copy()
    numeric_columns = [
        "น้ำหนักรวมที่บรรทุก(กิโลกรัม)", "ปริมาตรรวมที่บรรทุก(CBM)", "ความจุน้ำหนักสูงสุด",
        "ความจุปริมาตรสูงสุด", "Load Factor ที่ใช้จริง", "รายได้", "ต้นทุน", "กำไร",
        "% Load Factor จุดคุ้มทุน", "ต้นทุนสูญเปล่า factor",
    ]
    for column in numeric_columns:
        raw[f"_{column}"] = trip_num(raw[column])
    for column in ["เที่ยว", "ต้น-ปลาย", "ต้นทาง", "ปลายทาง", "Flag เหนือ-กทม", "ชนิดรถ", "ทะเบียน", "สถานะข้อมูล", "สถานะกำไร/ขาดทุน", "สถานะเทียบจุดคุ้มทุน"]:
        raw[f"_{column}"] = trip_text(raw[column])

    raw["_ต้นทุนสูญเปล่า factor"] = raw["_ต้นทุนสูญเปล่า factor"].replace([np.inf, -np.inf], np.nan)
    normal = raw["_สถานะข้อมูล"].eq("ปกติ")
    excluded = int((~normal).sum())
    clean = raw.loc[normal].copy()
    weight = clean["_น้ำหนักรวมที่บรรทุก(กิโลกรัม)"]
    capacity_kg = clean["_ความจุน้ำหนักสูงสุด"] * 1000
    volume = clean["_ปริมาตรรวมที่บรรทุก(CBM)"]
    volume_capacity = clean["_ความจุปริมาตรสูงสุด"]
    source_lf = clean["_Load Factor ที่ใช้จริง"]
    weight_lf = weight / capacity_kg
    volume_lf = volume / volume_capacity
    weight_valid = capacity_kg.gt(0) & weight.ge(0) & weight_lf.between(0, 1) & source_lf.between(0, 1) & (source_lf - weight_lf).abs().le(0.005)
    volume_valid = volume_capacity.gt(0) & volume.ge(0) & volume_lf.between(0, 1) & source_lf.between(0, 1) & (source_lf - volume_lf).abs().le(0.005)

    clean["_validated_lf"] = np.where(weight_valid, weight_lf, np.where(volume_valid, volume_lf, np.nan))
    clean["_lf_basis"] = np.where(weight_valid, "weight", np.where(volume_valid, "volume", "unvalidated"))
    clean["_capacity_kg"] = capacity_kg
    clean["_candidate_key"] = clean["_เที่ยว"] + " | " + clean["_ทะเบียน"] + " | " + clean["_ต้น-ปลาย"]
    clean.loc[clean["_candidate_key"].str.replace(" ", "", regex=False).eq("||"), "_candidate_key"] = "source-row-" + clean.index.astype(str)

    sum_columns = ["_น้ำหนักรวมที่บรรทุก(กิโลกรัม)", "_ปริมาตรรวมที่บรรทุก(CBM)", "_รายได้", "_ต้นทุน", "_กำไร"]
    trip_rows = []
    for key, group in clean.groupby("_candidate_key", sort=False):
        capacity_values = group["_capacity_kg"].dropna()
        weight_total = group["_น้ำหนักรวมที่บรรทุก(กิโลกรัม)"].sum(min_count=1)
        capacity_value = capacity_values.max() if not capacity_values.empty else np.nan
        # IMPORTANT: use only the already validated source Load Factor.  Do not
        # reconstruct LF from total weight/capacity here because the workbook's
        # "Load Factor ที่ใช้จริง" can be weight- or volume-based, and rows that
        # failed validation may contain extreme weight/CBM values.
        validated_lf_values = group["_validated_lf"].dropna()
        if not validated_lf_values.empty:
            # Candidate keys are almost always one source row.  When a key has
            # more than one source row, use the mean only when the values are
            # mutually consistent; otherwise keep LF unavailable rather than
            # fabricating a blended result.
            lf_spread = float(validated_lf_values.max() - validated_lf_values.min())
            load_factor = float(validated_lf_values.mean()) if lf_spread <= 0.02 else np.nan
        else:
            load_factor = np.nan
        basis_values = set(group.loc[group["_validated_lf"].notna(), "_lf_basis"].tolist())
        load_factor_basis = next(iter(basis_values)) if len(basis_values) == 1 else ("mixed" if basis_values else None)
        break_even_values = group["_% Load Factor จุดคุ้มทุน"].dropna().loc[lambda s: s.between(0, 1)]
        break_even = break_even_values.iloc[0] if len(break_even_values) and (break_even_values.max() - break_even_values.min() <= 0.005) else np.nan
        record = {
            "candidate_trip": key,
            "trip_reference": group["_เที่ยว"].iloc[0] or None,
            "route": group["_ต้น-ปลาย"].iloc[0] or None,
            "origin": group["_ต้นทาง"].iloc[0] or None,
            "destination": group["_ปลายทาง"].iloc[0] or None,
            "direction": group["_Flag เหนือ-กทม"].iloc[0] or None,
            "vehicle_type": group["_ชนิดรถ"].iloc[0] if group["_ชนิดรถ"].iloc[0] not in ("", "#N/A") else None,
            "license_plate": group["_ทะเบียน"].iloc[0] if group["_ทะเบียน"].iloc[0] not in ("", "#N/A") else None,
            "rows_in_source": int(len(group)),
            "wasted_cost": trip_json_number(group["_ต้นทุนสูญเปล่า factor"].sum(min_count=1)),
            "wasted_cost_numeric_rows": int(group["_ต้นทุนสูญเปล่า factor"].notna().sum()),
            "weight_kg": trip_json_number(weight_total),
            "revenue": trip_json_number(group["_รายได้"].sum(min_count=1)),
            "known_cost": trip_json_number(group["_ต้นทุน"].sum(min_count=1)),
            "contribution": trip_json_number(group["_กำไร"].sum(min_count=1)),
            "capacity_kg": trip_json_number(capacity_value),
            "load_factor": trip_json_number(load_factor if 0 <= load_factor <= 1 else np.nan),
            "load_factor_basis": load_factor_basis,
            "break_even_load_factor": trip_json_number(break_even),
        }
        if record["load_factor"] is not None and record["break_even_load_factor"] is not None:
            record["break_even_status"] = "below" if record["load_factor"] < record["break_even_load_factor"] else "at_or_above"
        else:
            record["break_even_status"] = None
        trip_rows.append(record)

    def aggregate_records(records, key_name):
        groups = {}
        for row in records:
            key = row.get(key_name) or "ไม่ระบุ"
            groups.setdefault(key, []).append(row)
        output = []
        for key, items in groups.items():
            def total(field):
                values = [item[field] for item in items if item[field] is not None]
                return sum(values) if len(values) == len(items) else None
            weight_total = total("weight_kg")
            # The validated LF may be weight- or volume-based.  Summing kg and
            # kg capacity would silently drop the volume basis, so route/fleet
            # LF is the mean utilization of validated candidate trips.
            valid_load_items = [item for item in items if item.get("load_factor") is not None]
            load_factor = (sum(item["load_factor"] for item in valid_load_items) / len(valid_load_items)) if valid_load_items else None
            revenue_total = total("revenue")
            cost_total = total("known_cost")
            contribution_total = total("contribution")
            valid_load = [item for item in items if item["load_factor"] is not None]
            output.append({
                key_name: key,
                **wasted_cost_metrics(items),
                "below_break_even_pct": sum(r.get("break_even_status") == "below" for r in items) / sum(r.get("break_even_status") is not None for r in items) * 100 if any(r.get("break_even_status") is not None for r in items) else None,
                "trip_count": len(items),
                "revenue": revenue_total,
                "known_cost": cost_total,
                "contribution": contribution_total,
                "weight_kg": weight_total,
                "capacity_kg": None,
                "load_factor": load_factor if load_factor is not None and 0 <= load_factor <= 1 else None,
                "validated_load_records": len(valid_load),
                "below_70_records": sum(item["load_factor"] < 0.70 for item in valid_load),
                "below_break_even_records": sum(item["break_even_status"] == "below" for item in items),
                "revenue_per_trip": revenue_total / len(items) if revenue_total is not None and items else None,
                "cost_per_trip": cost_total / len(items) if cost_total is not None and items else None,
                "contribution_per_trip": contribution_total / len(items) if contribution_total is not None and items else None,
                "cost_per_ton": cost_total / (weight_total / 1000) if cost_total is not None and weight_total not in (None, 0) else None,
            })
        return output

    routes = aggregate_records(trip_rows, "route")
    fleet = aggregate_records(trip_rows, "vehicle_type")
    direction = aggregate_records(trip_rows, "direction")
    numeric_fields = ["revenue", "known_cost", "contribution", "weight_kg", "load_factor", "revenue_per_trip", "cost_per_trip", "contribution_per_trip", "cost_per_ton"]
    for collection in (trip_rows, routes, fleet, direction):
        for row in collection:
            for field in numeric_fields:
                row[field] = trip_json_number(row.get(field))

    valid_trip_lf = [row["load_factor"] for row in trip_rows if row.get("load_factor") is not None]
    valid_trip_weights = [row["weight_kg"] for row in trip_rows if row.get("weight_kg") is not None and row.get("weight_kg") >= 0]
    financial_trip_costs = [row["known_cost"] for row in trip_rows if row.get("known_cost") is not None]
    totals = {
        **wasted_cost_metrics(trip_rows),
        "validated_trip_load_count": len(valid_trip_lf),
        "avg_load_factor": (sum(valid_trip_lf) / len(valid_trip_lf)) if valid_trip_lf else None,
        "median_load_factor": float(np.median(valid_trip_lf)) if valid_trip_lf else None,
        "below_70_records": sum(value < 0.70 for value in valid_trip_lf),
        "below_break_even_records": sum(row.get("break_even_status") == "below" for row in trip_rows),
        "total_weight_kg": sum(valid_trip_weights) if valid_trip_weights else None,
        "financial_trip_count": len(financial_trip_costs),
        "total_known_cost": sum(financial_trip_costs) if financial_trip_costs else None,
        "cost_per_trip": (sum(financial_trip_costs) / len(financial_trip_costs)) if financial_trip_costs else None,
    }
    load_bands = {
        "below_50": sum(value < 0.50 for value in valid_trip_lf),
        "from_50_to_70": sum(0.50 <= value < 0.70 for value in valid_trip_lf),
        "at_or_above_70": sum(value >= 0.70 for value in valid_trip_lf),
        "total": len(valid_trip_lf),
    }

    return {
        "ok": True,
        "source": str(path.relative_to(INPUT_DIR)),
        "sheet": source_sheet,
        "wasted_cost_source": {"column": "ต้นทุนสูญเปล่า factor", "sheet": source_sheet,
            "numeric_source_rows": int(raw["_ต้นทุนสูญเปล่า factor"].notna().sum()),
            "valid_numeric_rows": int(clean["_ต้นทุนสูญเปล่า factor"].notna().sum()),
            "missing_normal_rows": int(clean["_ต้นทุนสูญเปล่า factor"].isna().sum()),
            "excluded_numeric_rows": int(raw.loc[~normal, "_ต้นทุนสูญเปล่า factor"].notna().sum()),
            "negative_normal_rows": int(clean["_ต้นทุนสูญเปล่า factor"].lt(0).sum()),
            "trip_basis": "existing candidate key: manifest + plate + directional route; numeric rows only"},
        "source_rows": int(len(raw)),
        "normal_rows": int(normal.sum()),
        "excluded_rows": excluded,
        "candidate_trip_count": len(trip_rows),
        "route_count": len(routes),
        "vehicle_type_count": len([row for row in fleet if row["vehicle_type"] not in (None, "ไม่ระบุ")]),
        "totals": {key: trip_json_number(value) if isinstance(value, (float, np.floating)) else value for key, value in totals.items()},
        "load_bands": load_bands,
        "data_quality": {
            "source_lf_invalid_range_rows": int((normal & ~raw["_Load Factor ที่ใช้จริง"].between(0, 1)).sum()),
            "validated_weight_lf_rows": int(weight_valid.sum()),
            "validated_volume_lf_rows": int(volume_valid.sum()),
            "validated_load_rows": int((weight_valid | volume_valid).sum()),
            "validated_candidate_trip_loads": len(valid_trip_lf),
            "missing_capacity_rows": int(raw["_ความจุน้ำหนักสูงสุด"].isna().sum()),
            "missing_vehicle_rows": int(raw["_ชนิดรถ"].isin(["", "#N/A"]).sum()),
            "missing_license_plate_rows": int(raw["_ทะเบียน"].isin(["", "#N/A"]).sum()),
            "wasted_cost_validated": bool(totals["wasted_cost_valid_trips"]),
            "empty_trip_validated": False,
            "service_group_available": False,
        },
        "available_metrics": {
            "revenue": True, "known_cost": True, "contribution": True,
            "revenue_per_trip": True, "cost_per_trip": True, "contribution_per_trip": True,
            "cost_per_ton": True, "validated_load_factor": True,
            "empty_trip": False, "empty_backhaul": False, "wasted_cost": bool(totals["wasted_cost_valid_trips"]),
        },
        "rows": trip_rows,
        "routes": routes,
        "fleet": fleet,
        "direction": direction,
        "errors": [],
    }


_cache={"signature":None,"data":None}

def current_signature():
    rows=[]
    for p in sorted(INPUT_DIR.rglob("*"), key=lambda x: str(x).lower()):
        if not p.is_file() or p.name.startswith(".") or p.suffix.lower() not in EXTRACTABLE:
            continue
        rows.append((str(p.relative_to(INPUT_DIR)), p.stat().st_mtime_ns, p.stat().st_size, category_for(p)))
    return tuple(rows)

def signature_json(sig):
    return [list(x) for x in sig]

def read_dashboard_cache():
    cache_path=DATA_DIR/"dashboard_data.json"
    if not cache_path.exists():
        return {
            "ok": False, "cached": False, "needs_process": True,
            "available_years": [], "years": [], "errors": [],
            "source_catalog": input_files(),
            "message": "ยังไม่มีข้อมูลที่ประมวลผล กรุณากด ‘ประมวลผลข้อมูล’ หนึ่งครั้ง"
        }
    try:
        data=json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception as e:
        return {"ok":False,"cached":False,"needs_process":True,"years":[],"available_years":[],"errors":[],"source_catalog":input_files(),"message":f"อ่าน cache ไม่สำเร็จ: {e}"}
    sig=current_signature()
    cached_sig=tuple(tuple(x) for x in data.get("source_signature",[]))
    data["cached"]=True
    data["needs_process"]=(cached_sig != sig or data.get("processor_version") != PROCESSOR_VERSION)
    data["source_catalog"] = input_files()
    if data["needs_process"]:
        data["message"]="ไฟล์ข้อมูลมีการเปลี่ยนแปลง กรุณากด ‘ประมวลผลข้อมูล’ เพื่ออัปเดต Dashboard"
    return data

def attach_route_operations(financial, operational):
    """Join aggregated route summaries only; never expand financial records."""
    from collections import defaultdict, Counter
    def key(value):
        return re.sub(r"\s+", "", str(value or "")).replace("→", "-")
    groups = defaultdict(list)
    for row in operational.get("rows", []):
        if row.get("route"):
            groups[key(row["route"])].append(row)
    matched = 0
    for route in financial.get("routes", []):
        rows = groups.get(key(route["route"]), [])
        valid = [r for r in rows if r.get("load_factor") is not None]
        flags = {r["direction"] for r in rows if r.get("direction")}
        # Preserve units: capacity-weight only when every valid value uses kg.
        weight_basis = valid and all(r.get("load_factor_basis") == "weight" and (r.get("capacity_kg") or 0) > 0 for r in valid)
        lf = (sum(r["load_factor"] * r["capacity_kg"] for r in valid) / sum(r["capacity_kg"] for r in valid)) if weight_basis else (sum(r["load_factor"] for r in valid) / len(valid) if valid else None)
        be = [r for r in rows if r.get("break_even_status") is not None]
        route["operations"] = {
            "matched": bool(rows), "records": len(rows), "validated_load_records": len(valid),
            "load_factor": lf, "load_basis": "capacity_weighted" if weight_basis else "validated_mean" if valid else None,
            "below_70_pct": sum(r["load_factor"] < .7 for r in valid) / len(valid) * 100 if valid else None,
            "below_break_even_pct": sum(r["break_even_status"] == "below" for r in be) / len(be) * 100 if be else None,
            "direction": next(iter(flags)) if len(flags) == 1 else "ไม่ระบุ/หลายทิศทาง",
        }
        matched += bool(rows)
    counts = Counter(r.get("trip_reference") for r in operational.get("rows", []) if r.get("trip_reference"))
    financial["route_join"] = {"method": "independent_route_aggregation", "matched_routes": matched,
        "total_routes": len(financial.get("routes", [])), "operational_source": operational.get("source"),
        "duplicate_operational_manifest_rows": sum(n-1 for n in counts.values() if n > 1),
        "financial_amounts_unchanged": True}


def build_dashboard_data():
    files=prepared_files()
    signature=current_signature()
    years=[]; errors=[]
    for y,p in files:
        try:
            years.append(build_year_data(y,p))
        except Exception as e:
            errors.append({"year":y,"file":str(p.relative_to(INPUT_DIR)),"error":str(e)})
    customer_summary = build_customer_summary()
    trip_summaries = {}
    for year, path in trip_sources().items():
        summary = build_trip_summary(path)
        summary["year"] = year
        for financial in years:
            if financial["year"] == year:
                attach_route_operations(financial, summary)
        (DATA_DIR / f"trip_summary_{year}.json").write_text(json.dumps(summary, ensure_ascii=False, allow_nan=False), encoding="utf-8")
        trip_summaries[str(year)] = {k: v for k, v in summary.items() if k != "rows"}
    trip_summary = trip_summaries[str(max(map(int, trip_summaries)))] if trip_summaries else build_trip_summary()
    customer_cache_path = DATA_DIR / "customer_summary.json"
    customer_cache_path.write_text(json.dumps(customer_summary, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    trip_cache_path = DATA_DIR / "trip_summary.json"
    trip_cache_path.write_text(json.dumps(trip_summary, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    # The executive dashboard only needs aggregates. Keep candidate-level rows
    # in trip_summary.json for future drill-down, but do not send ~30k rows on
    # every /api/dashboard request.
    trip_dashboard = {key: value for key, value in trip_summary.items() if key != "rows"}
    if customer_summary.get("errors"):
        errors.append({"file": customer_summary.get("source") or "customer dataset", "error": "; ".join(customer_summary["errors"])})
    data={
        "ok": bool(years),
        "cached": True,
        "needs_process": False,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "processor_version": PROCESSOR_VERSION,
        "source_signature": signature_json(signature),
        "source_catalog": input_files(),
        "years": years,
        "customer_summary": customer_summary,
        "trip_summary": trip_dashboard,
        "trip_summaries": trip_summaries,
        "available_years": [x["year"] for x in years],
        "errors": errors,
        "instructions": "เมื่อไฟล์ข้อมูลเปลี่ยน ให้กดประมวลผลข้อมูลหนึ่งครั้ง จากนั้น Dashboard จะอ่าน cache อย่างรวดเร็ว",
        "processor_note": "Dashboard ใช้ Prepared Dataset, customer-level dataset และ validated trip summary ตามหน้าที่เกี่ยวข้อง; ข้อมูลที่ไม่ผ่าน validation จะไม่ถูกเติมค่าและไม่รวมใน management KPI",
    }
    _cache["signature"]=signature; _cache["data"]=data
    (DATA_DIR/"dashboard_data.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    return data



class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(BASE_DIR),**kwargs)
    def log_message(self,fmt,*args):
        sys.stdout.write("[%s] %s\n"%(self.log_date_time_string(),fmt%args))
    def send_json(self,obj,status=200):
        raw=json.dumps(obj,ensure_ascii=False).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(raw))); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(raw)
    def end_headers(self):
        # Disable browser caching during local development so new JS/CSS appears immediately.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def do_GET(self):
        path=self.path.split("?",1)[0]
        if path=="/api/files": return self.send_json({"files":input_files()})
        if path=="/api/dashboard":
            try: return self.send_json(read_dashboard_cache())
            except Exception as e: return self.send_json({"ok":False,"error":str(e)},500)
        return super().do_GET()
    def do_POST(self):
        path=self.path.split("?",1)[0]
        if READ_ONLY_DEPLOY and path in {"/api/upload", "/api/process"}:
            return self.send_json({"error":"บริการนี้เปิดแบบอ่านอย่างเดียว"},405)
        if path=="/api/upload": return self.handle_upload()
        if path=="/api/process":
            # Rebuild dashboard after files are already present/uploaded.
            _cache["signature"]=None
            try:
                data=build_dashboard_data()
                return self.send_json({"ok":data.get("ok",False),"dashboard":data,"files":input_files()})
            except Exception as e:
                return self.send_json({"error":str(e)},500)
        self.send_json({"error":"Not found"},404)
    def handle_upload(self):
        try: length=int(self.headers.get("Content-Length","0"))
        except ValueError: return self.send_json({"error":"Content-Length ไม่ถูกต้อง"},400)
        if length<=0: return self.send_json({"error":"ไฟล์ว่าง"},400)
        if length>MAX_UPLOAD: return self.send_json({"error":"ไฟล์ใหญ่เกิน 750 MB"},413)
        filename=Path(unquote(self.headers.get("X-Filename","")).strip()).name
        suffix=Path(filename).suffix.lower()
        if not filename or suffix not in ALLOWED: return self.send_json({"error":"รองรับเฉพาะ .xlsx, .xls, .csv, .zip"},400)
        folder=ARCHIVE_DIR if suffix==".zip" else INPUT_DIR
        target=(folder / filename) if suffix != ".zip" else unique_path(folder, filename); remaining=length
        if target.exists() and suffix != ".zip":
            target.unlink()
        with target.open("wb") as f:
            while remaining>0:
                chunk=self.rfile.read(min(1024*1024,remaining))
                if not chunk: raise IOError("การรับไฟล์ถูกตัดกลางคัน")
                f.write(chunk); remaining-=len(chunk)
        extracted=[]
        if suffix==".zip": extracted=extract_zip(target)
        requested = self.headers.get("X-Data-Type", "auto").strip()
        reg = load_registry()
        if suffix != ".zip":
            rel = str(target.relative_to(INPUT_DIR))
            reg[rel] = {
                "category": classify_name(target.name) if requested in ("", "auto") else requested,
                "uploaded_at": datetime.now().isoformat(timespec="seconds"),
            }
        else:
            for name in extracted:
                ep = INPUT_DIR / name
                rel = str(ep.relative_to(INPUT_DIR))
                reg[rel] = {
                    "category": classify_name(ep.name) if requested in ("", "auto") else requested,
                    "uploaded_at": datetime.now().isoformat(timespec="seconds"),
                }
        save_registry(reg)
        _cache["signature"]=None
        return self.send_json({"ok":True,"saved":target.name,"extracted":extracted,"files":input_files()})


if __name__=="__main__":
    print("\nNIM Executive Analytics — Decision Support Server")
    print(f"เปิดเว็บที่: http://localhost:{PORT}")
    print(f"โฟลเดอร์ข้อมูล: {INPUT_DIR}")
    print("ปัจจุบันใช้ Prepared Dataset (เช่น PQ67/PQ68/PQ69) เป็นฐาน Dashboard และรองรับการจัดเก็บข้อมูลประเภทอื่นเพิ่มเติม\n")
    server=ThreadingHTTPServer((HOST,PORT),Handler)
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nหยุด server แล้ว")
    finally: server.server_close()
