"""Read the CM worksheet; preserve source amounts and audit rejected rows."""
from collections import Counter, defaultdict
from datetime import datetime, date
import math
from openpyxl.utils.datetime import from_excel

COLUMNS = ['เลขที่ใบรายการ', 'Date', 'ต้นทาง-ปลายทางที่ไกลที่สุด', 'รวมรายได้',
           'ชนิดรถ', 'ต้นทุนผันแปร', 'Contribution Margin']


def finite(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def parse_cm(wb, year, source):
    normalized_sheets = {''.join(str(name).split()): name for name in wb.sheetnames}
    full_year_2568 = next((normalized_sheets[key] for key in ('รวมทั้งปี68', 'รวมทั้งปี2568') if key in normalized_sheets), None)
    quarter_sheets = [f"ไตรมาสที่{i}" for i in range(1, 5)]
    if year == 2568 and full_year_2568:
        sheet_names = [full_year_2568]
    elif any(name in wb.sheetnames for name in quarter_sheets):
        missing_sheets = [name for name in quarter_sheets if name not in wb.sheetnames]
        if missing_sheets:
            raise ValueError(f"ข้อมูลไตรมาสไม่ครบ: {', '.join(missing_sheets)}")
        sheet_names = quarter_sheets
    else:
        sheet_names = ['CM']
    deduplicate_full_year_2568 = year == 2568 and full_year_2568 in sheet_names
    records = []
    source_sheets = []
    for sheet_name in sheet_names:
        rows = wb[sheet_name].iter_rows(values_only=True)
        headers = [str(v).strip().replace('Contibution Margin', 'Contribution Margin') for v in next(rows)]
        if 'ชนิดรถ' not in headers and 'ชนิดรถ3' in headers:
            headers[headers.index('ชนิดรถ3')] = 'ชนิดรถ'
        missing = set(COLUMNS) - set(headers)
        if missing:
            raise ValueError(f'{sheet_name}: missing columns: {sorted(missing)}')
        sheet_records = [(i, {**dict(zip(headers, r)), '_sheet': sheet_name}) for i, r in enumerate(rows, 2) if any(v is not None for v in r)]
        records.extend(sheet_records)
        source_sheets.append({'sheet': sheet_name, 'source_rows': len(sheet_records)})
    counts = Counter(str(r['เลขที่ใบรายการ']).strip() for _, r in records if r['เลขที่ใบรายการ'] is not None)
    accepted, issues, negative_rows, dates = [], [], [], []
    seen_full_year_keys = set()
    for row_number, r in records:
        reasons = []
        key = str(r['เลขที่ใบรายการ'] or '').strip()
        if deduplicate_full_year_2568 and key in seen_full_year_keys:
            continue
        if deduplicate_full_year_2568 and key:
            seen_full_year_keys.add(key)
        dt = r['Date']
        if isinstance(dt, (int, float)) and not isinstance(dt, bool):
            try:
                dt = from_excel(dt, wb.epoch)
            except (ValueError, OverflowError):
                dt = None
        if not isinstance(dt, (datetime, date)) or dt.year + 543 != year:
            reasons.append('missing_date_or_wrong_year')
        else:
            dates.append(dt.isoformat()[:10])
        if not key or (counts[key] > 1 and not deduplicate_full_year_2568):
            reasons.append('missing_or_duplicate_manifest')
        values = [finite(r[k]) for k in ['รวมรายได้', 'ต้นทุนผันแปร', 'Contribution Margin']]
        if any(v is None for v in values):
            reasons.append('missing_or_invalid_financial_value')
        elif abs(values[0] - values[1] - values[2]) > .01:
            reasons.append('cm_reconciliation_mismatch')
        if values[1] is not None and values[1] < 0:
            negative_rows.append(row_number)
        if reasons:
            issues.append({'sheet': r['_sheet'], 'excel_row': row_number, 'reasons': reasons, 'revenue': values[0], 'variable_cost': values[1], 'contribution': values[2]})
            continue
        accepted.append({'month': dt.strftime('%Y-%m'), 'route': str(r['ต้นทาง-ปลายทางที่ไกลที่สุด'] or 'ยังไม่ได้ระบุ').strip(),
                         'vehicle': str(r['ชนิดรถ'] or 'ยังไม่ได้ระบุ').strip(),
                         'depreciation': finite(r.get('ค่าเสื่อมราคา')),
                         'revenue': values[0], 'variable_cost': values[1], 'contribution': values[2]})
    def aggregate(items):
        totals = {k: math.fsum(r[k] for r in items) if items else None for k in ['revenue', 'variable_cost', 'contribution']}
        return {**totals, 'trip_count': len(items), 'margin_pct': totals['contribution'] / totals['revenue'] * 100 if totals['revenue'] else None,
                'all_costs': totals['variable_cost'], 'operating_surplus': totals['contribution'], 'known_cost': totals['variable_cost']}
    def grouped(key):
        groups = defaultdict(list)
        for r in accepted:
            groups[r[key]].append(r)
        return [{key: label, **aggregate(items)} for label, items in sorted(groups.items())]
    totals = aggregate(accepted)
    depreciation_values = [r['depreciation'] for r in accepted if r['depreciation'] is not None]
    scenario_costs = {'depreciation': math.fsum(depreciation_values) if accepted and len(depreciation_values) == len(accepted) else None,
                      'depreciation_valid_rows': len(depreciation_values), 'financial_rows': len(accepted),
                      'variable_cost': totals['variable_cost'], 'basis': 'Same complete financial rows as CM'}
    return {'year': year, 'source': source, 'source_sheet': ' + '.join(sheet_names), 'source_sheets': source_sheets, 'financial_basis': 'contribution_margin',
            'period': {'start': min(dates) if dates else None, 'end': max(dates) if dates else None},
            'overview': {'totals': totals, 'monthly': grouped('month')},
            'scenario_costs': scenario_costs,
            'profit_summary': {'revenue': totals['revenue'], 'cost': totals['variable_cost'], 'profit': totals['contribution'], 'margin': totals['margin_pct']},
            'routes': grouped('route'), 'vehicles': grouped('vehicle'), 'service_groups': [],
            'data_quality': {'source_rows': len(records), 'included_rows': len(accepted), 'excluded_rows': len(issues),
                             'negative_variable_cost_rows': len(negative_rows), 'negative_variable_cost_excel_rows': negative_rows,
                             'issues': issues, 'basis': 'Matched complete rows; negative source costs retained and flagged.'}}
