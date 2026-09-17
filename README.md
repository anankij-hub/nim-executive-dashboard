# NIM Executive Dashboard v6.8

v6.8: แก้ Load Factor ที่ผิดปกติจากการ aggregate คนละฐานหน่วย, ย้ายการคำนวณ LF หลักไปฝั่ง server, ลด payload หน้าเว็บ และปรับ Fleet Utilization ให้เป็น executive analysis มากขึ้น

# NIM Executive Analytics v6

Local executive dashboard / decision-support prototype for NIM Transport.

## What's new in v6

- Generic buttons: **ประมวลผลข้อมูล** and **อัปโหลดข้อมูล** (no longer tied to the term PQ).
- Generic local data catalog with automatic/selected categories:
  - Prepared Dataset
  - Revenue / Bill
  - Trip Expense
  - Fuel
  - Maintenance
  - Vehicle Rental
  - Vehicle Master
  - Route Master
  - Receivables
- New **Scenario Planning** page with:
  - Revenue target
  - Travel/fuel/repair/rental efficiency assumptions
  - Cost-scaling option
  - Projected revenue, cost, result and margin
  - Current vs Scenario comparison
  - Reverse planning from target profit/result to required revenue
- Data Sources page shows which files are currently used in the dashboard and which are stored for future mapping.
- Uploading a file with the same filename replaces the previous version.
- Service-group parser now falls back to the `กลุ่มบริการ (ของย่อย)` style table so revenue by service can still be shown when a full service-profit table is absent.

## Important calculation note

The current Dashboard processor still uses **Prepared Dataset files (such as PQ67/PQ68/PQ69)** as the main source for Overview, Route, Fleet and Service dashboards. Other uploaded data types are catalogued and stored locally, ready for later mapping into more detailed modules such as Load Factor, Empty Trip, Customer Profitability and DSO.

Scenario Planning is a **what-if estimate**, not a forecast. If `ให้ต้นทุนฐานปรับตามสัดส่วนยอดขาย` is enabled, baseline costs scale with the revenue ratio before applying the selected efficiency reductions.

## Run locally on macOS

```bash
cd ~/Downloads/nim-executive-dashboard-v6
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

Open:

```text
http://localhost:8765
```

Place prepared files in `input/` or use **อัปโหลดข้อมูล** in the web app, then click **ประมวลผลข้อมูล**.

## Deploy as a read-only public dashboard on Render

This project includes `render.yaml` for Render. Push the project to a GitHub repository, create a Render Web Service from that repository, and use the included Blueprint configuration. The service runs:

```text
Build: pip install -r requirements.txt
Start: python server.py
```

The deployment sets `HOST=0.0.0.0`, uses Render's `PORT`, and enables `READ_ONLY_DEPLOY=1`. Public users can read the prepared dashboard but cannot upload files or trigger data processing. Keep source Excel/CSV files out of the repository; the processed JSON in `data/` must be reviewed for sensitive customer information before publishing.

Current deployment cache includes financial and trip summaries for years 2567, 2568, and 2569.

For local development, leave `READ_ONLY_DEPLOY` unset so the upload and processing controls continue to work.


## v6.1 — Route Analysis
เพิ่ม Filter สำหรับทิศทาง กทม./ปริมณฑล → สายเหนือ และสายเหนือ → กทม./ปริมณฑล, ตัวเลือก Metric, การเรียงมาก→น้อย/น้อย→มาก, จำนวนรายการ, ค้นหาเส้นทาง และตารางเปรียบเทียบสองทิศทางตามจุดสายเหนือ

## v6.2 — Fleet Performance
- เพิ่ม Filter ตัวชี้วัด / เรียงมาก→น้อย-น้อย→มาก / สถานะ / จำนวนแสดง / ค้นหาชนิดรถ
- เพิ่ม Margin = ส่วนต่างหลังต้นทุนที่ทราบ / รายได้
- เพิ่ม ผลตอบแทนต่อต้นทุน (Return on Cost) = ส่วนต่างหลังต้นทุนที่ทราบ / ต้นทุนที่ทราบ × 100
- รายการที่ต้นทุนเป็น 0 จะแสดง N/A สำหรับ Return on Cost เพื่อไม่ให้เกิดค่าอนันต์หรือ Ranking ที่ทำให้เข้าใจผิด
- เพิ่มตารางรายละเอียดและ KPI Summary หลัง Filter

## v6.3 — Service Analysis filters
เพิ่มความสามารถในหน้า Service Analysis ให้ทำงานคล้าย Fleet Performance:
- เลือกตัวชี้วัด: รายได้ / ต้นทุน / ผลตอบแทน / Margin / ผลตอบแทนต่อต้นทุน
- เรียงมาก→น้อย หรือ น้อย→มาก
- กรองสถานะผลตอบแทนและความพร้อมของต้นทุน
- ค้นหากลุ่มบริการ และเลือกจำนวนรายการ
- KPI สรุปตาม Filter
- ตารางแสดง Margin, ผลตอบแทนต่อต้นทุน และสถานะความครบของต้นทุน
- ถ้าต้นทุนเป็นศูนย์จากข้อมูลที่ไม่ครบ จะไม่ตีความเป็น Margin 100% โดยอัตโนมัติ แต่แสดง N/A


## v6.4 — Route efficiency metrics
- เพิ่ม Margin (%) และผลตอบแทนต่อต้นทุน (%) ใน Route Analysis
- เพิ่ม Filter สถานะ: ส่วนต่างบวก/ลบ, Margin < 10%, ผลตอบแทนต่อต้นทุน < 10%, มี/ไม่มีต้นทุน
- เพิ่ม KPI Summary: Margin รวม และผลตอบแทนต่อต้นทุนรวม
- ตารางเส้นทางเพิ่มคอลัมน์ Margin และผลตอบแทน/ต้นทุน
- Ranking สามารถเรียงด้วยตัวชี้วัดใหม่ได้ทั้งมาก→น้อยและน้อย→มาก
- ค่า Return on Cost จะแสดง N/A เมื่อไม่มีต้นทุน เพื่อไม่ให้เกิด Infinity หรือ Ranking ที่ทำให้เข้าใจผิด

## v6.5 — Cost vs Profitability Matrix
เพิ่มเมนู **Cost–Profit Matrix** สำหรับวิเคราะห์เส้นทางเป็น 4 Quadrants:
- Star Trips — ต้นทุนต่ำกว่าเกณฑ์ / กำไรสูงกว่าเกณฑ์
- Volume Trap — ต้นทุนต่ำกว่าเกณฑ์ / กำไรต่ำกว่าเกณฑ์
- Problem Trips — ต้นทุนสูงกว่าเกณฑ์ / กำไรต่ำกว่าเกณฑ์
- Niche / High Yield — ต้นทุนสูงกว่าเกณฑ์ / กำไรสูงกว่าเกณฑ์

ระบบใช้ Median ของข้อมูลที่ผ่าน Filter เป็นเส้นแบ่งอัตโนมัติ และเลือกแกนกำไรได้ระหว่าง Margin กับผลตอบแทนต่อต้นทุน พร้อม Filter ทิศทางและ Quadrant

> หมายเหตุ: Prepared Dataset ปัจจุบันยังไม่มีจำนวนเที่ยว/น้ำหนักครบในระดับ Route ดังนั้นแกน X ใช้ **ต้นทุนที่ทราบต่อเส้นทาง** เป็น Proxy ชั่วคราว เมื่อมี Trip/Manifest + Weight/Capacity แล้วควรเปลี่ยนเป็น Cost/Trip หรือ Cost/Ton

## v6.6 — Customer Profitability & Management Priority
- เพิ่มหน้า Customer Profitability & Management Priority จากไฟล์ `input/ข้อมูลลูกค้ารายคน.csv`
- เพิ่ม Customer-level cache ที่ `data/customer_summary.json` โดยไม่โหลด raw transaction data เข้า browser
- เพิ่ม Contribution, Margin, Return on Cost, Profit Leakage และ Revenue at Risk ตามข้อมูลจริง
- เพิ่ม percentile-ranked Management Priority Queue สำหรับลูกค้าที่ Contribution ติดลบเท่านั้น
- เพิ่ม Customer Profitability Matrix, portfolio summary, Top Profit Contributors และ Largest Profit Leakage
- เพิ่ม filter, sorting, Top 25/50/100 และ pagination 25/50/100 rows

## v6.7 — Five-page seminar architecture and trip data
- รวม dashboard เป็น 5 หน้าเชิงวิเคราะห์: Executive Overview, Trip & Route Profitability, Fleet Utilization & Load Efficiency, Customer Profitability & Credit Risk และ Management Action & Scenario
- ย้าย Data Sources เป็น utility ใน header โดยไม่คิดเป็น analytical page
- เพิ่ม parser และ cache `data/trip_summary.json` จาก `input/สรุปเที่ยว 68 ของจริง.xlsx`
- ตัด records `ผิดปกติ-ตัดออก` ออกจาก management KPI โดยค่าเริ่มต้น
- เพิ่ม Revenue/Cost/Contribution per candidate trip record, Cost/Ton และ validated weighted Load Factor
- แสดง N/A สำหรับ Empty Trip, Empty Backhaul, Service Group, Wasted Cost และ Credit Risk ที่ยังไม่มี source ที่ยืนยันได้
- ยังไม่คำนวณ Cost/Ton-km เพราะ workbook ปัจจุบันไม่มีระยะทางกิโลเมตร


## v6.8 — Load Factor validation & Fleet executive view

- Load Factor KPI ใช้ค่าที่ผ่าน validation จาก `Load Factor ที่ใช้จริง` เท่านั้น
- ไม่รวม weight/volume basis เข้าด้วยกันด้วยสูตรที่หน่วยไม่สอดคล้อง
- Route/Fleet Load Factor แสดงค่าเฉลี่ยของ candidate trips ที่ผ่าน validation
- Dashboard API ไม่ส่ง candidate trip rows ~29k แถวทุกครั้ง; รายละเอียดเต็มเก็บใน `data/trip_summary.json`
- Fleet page เพิ่ม KPI, Load Factor distribution, Direction comparison, Cost/Trip vs Load Factor และ Fleet Diagnostic Table
- Empty Trip / Backhaul / Wasted Cost ยังแสดง N/A จนกว่าจะมีนิยาม/source ที่ยืนยันได้

## CM financial source (ปี 2569)

ไฟล์ `Contribution Margin 2569.xlsx` ใช้เฉพาะชีท `CM` เป็นแหล่งหลักของปี 2569 และมีลำดับความสำคัญเหนือ Prepared Dataset ของปีเดียวกัน รองรับชื่อไฟล์ที่มี `Contribution Margin` หรือขึ้นต้นด้วย `CM` และมีปี พ.ศ. ในชื่อไฟล์

- รายได้ = `รวมรายได้`; ต้นทุน = `ต้นทุนผันแปร`; CM = `Contribution Margin` จากต้นฉบับ
- ตรวจสอบ CM = รายได้ − ต้นทุนผันแปร (คลาดเคลื่อนไม่เกิน 0.01 บาท)
- KPI ทั้งสามใช้รายการชุดเดียวกัน: วันที่ตรงปี เลขที่ใบรายการไม่ว่าง/ไม่ซ้ำ และตัวเลขครบถ้วน
- แถวที่ไม่ผ่านเก็บเหตุผลและเลขแถว Excel ใน `years[].data_quality.issues` ของ `data/dashboard_data.json`; ไม่แทนข้อมูลหายด้วยศูนย์
- ต้นทุนผันแปรติดลบคงค่าตามต้นฉบับและแสดงจำนวนให้ตรวจสอบ
- แสดงช่วงวันที่จริง ไม่ตีความเป็นข้อมูลเต็มปี และไม่รวมข้อมูลลูกค้าหรือ Load Factor คนละปีกับ CM
- Scenario ใช้อัตราต้นทุนผันแปรต่อรายได้ และให้กำหนดเปอร์เซ็นต์ลดต้นทุนผันแปร
- ตัวอ่าน CM อยู่ใน `cm_data.py` เรียกผ่าน pipeline ของ `server.py`

ตรวจสอบ: `.venv/bin/python -m unittest test_cm_data.py` และ `node --check app.js`

### CM ปี 2567 แยกไตรมาส

รองรับไฟล์ `Contribution Margin 2567.xlsx` ที่มีชีท `ไตรมาสที่1` ถึง `ไตรมาสที่4` โดยอ่านครบทั้งสี่ชีทก่อนรวมยอดรายเดือน เส้นทาง และชนิดรถ ตรวจเลขที่ใบรายการซ้ำข้ามชีท และเก็บชื่อชีท/เลขแถวที่ไม่ผ่านในรายงานคุณภาพ รองรับหัวคอลัมน์ `Contibution Margin` และวันที่แบบเลข serial ของ Excel หากมีชีทไตรมาสแต่ไม่ครบสี่ชีท จะรายงานข้อผิดพลาดแทนการแสดงเป็นยอดครบปี

## v6.9 — Trip & Route Profitability redesign

The five-page architecture is unchanged. The route page now includes five KPI cards, Top 10 ranking, a revenue/CM portfolio, CM percentage bands, a direction donut, clickable alerts and a paginated detail table. Year, direction, route and search filters apply to KPIs, charts and the table. Sorting/row count affect table presentation; ranking always selects the highest ten values of its metric.

Financial source for 2569: `Contribution Margin 2569.xlsx / CM` (user confirmed this filename instead of the requested `(1)` copy). Operational source: `สรุปเที่ยว 69.xlsx / รวม`. Financial summaries are joined to separately aggregated, normal/validated operational route data by whitespace-normalized directional route name. No transaction-level many-to-many join. Missing operational matches retain financial totals and show N/A. Direction uses the operational Flag only when consistent, otherwise `ไม่ระบุ/หลายทิศทาง`.

Route LF uses capacity weighting where all valid observations have a weight basis and valid kg capacity. Mixed bases use the existing validated average, explicitly documented under expandable coverage. Percent below 70% uses validated LF records; percent below break-even uses only comparable records. Financial per-trip figures use complete, unique CM manifest counts, not operational record counts.

Portfolio thresholds are medians of filtered routes. To keep actual CM outliers readable, the default vertical display focuses on P5–P95 (expanded to cover 0–100%); out-of-range points remain at the boundary with dashed outlines and exact tooltip values. Select `ทุกค่า` for the full linear range. Charts do not fabricate YoY growth, geographic regions, or values from the mockup. Negative direction totals use a signed list instead of a donut. Export buttons are omitted because there was no existing export implementation.

### Run / verify

Start `.venv/bin/python server.py`, open `http://localhost:8765`, process after changing input files, then choose Trip & Route Profitability. Cache-busting updated for JS and CSS.

```sh
.venv/bin/python -m unittest test_cm_data.py test_route_join.py
node test_route_portfolio.js
node test_dashboard_load.js
node test_scenario.js
node --check app.js
```

Optional browser regression: `test_browser_route.cjs` uses Playwright and Chromium installed separately. Set `PLAYWRIGHT_MODULE` to its package path and `PLAYWRIGHT_BROWSERS_PATH` to the installed browser directory if not using standard paths. It tests filters, pagination, all years, all five pages, and captures local screenshots in `/tmp`.

## Fleet executive redesign

Fleet Utilization & Load Efficiency now shows six summary cards, a five-type ranking with selectable metrics, four service cards with inline SVG icons, validated LF distribution and direction comparison, followed by a searchable/sortable/paginated vehicle table. The vehicle ranking and table share filters; top KPIs remain the selected year's overall totals. Existing financial tables, service filters and the cost/load scatter remain in expandable sections below.

All metrics reuse existing prepared summaries. CM financial per-trip values retain CM complete-record denominators; operations retain their own grouped-record counts. Service cards use the separately selected PQ year, explicitly labeled, without allocating service data to vehicles. Service trips and LF remain N/A; bill-clearing missing cost also leaves contribution/margin N/A. Cost/Ton remains unavailable where the operational cost/weight totals are incomplete. No year-over-year values or service-by-vehicle counts are invented. LF averages retain the existing validated aggregation method. Weight KPI is labeled as the sum of records with weight data.

Validation: `node test_fleet_executive.js`, plus the existing route, dashboard and scenario tests. Local Chromium checks cover all years, the remaining four pages, filters, service-year selection, pagination and laptop overflow.

### Fleet: ต้นทุนสูญเปล่าจาก Load Factor

Uses the existing `ต้นทุนสูญเปล่า factor` Excel field, without recalculating its formula. Only `ปกติ` source rows contribute; missing/error values remain unavailable. Fleet shows the source file/sheet, total, average per numeric candidate trip, positive-trip percentage, top-ten vehicle/route rankings and diagnostic columns. Candidate trip = manifest + plate + directional route. LF and CM retain their existing separate populations and formulas. Service-group wasted cost is unavailable without a reliable mapping.

Validate with `.venv/bin/python -m unittest test_wasted_cost test_cm_data test_route_join`, `node test_fleet_executive.js`, and `test_browser_fleet.cjs` with Playwright installed.
