import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck,
  Layers,
  Sliders,
  Settings,
  X,
  RefreshCw,
  AlertTriangle,
  Scale,
  Maximize,
  Plus,
  Trash2,
  PackageOpen,
  CloudOff,
  Check,
  Loader
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface CargoItem {
  id: string;
  width: number;
  length: number;
  height: number;
  weight: number;
  quantity: number;
}

interface Vehicle {
  rank: number;
  type: string;
  maxWeight: number;
  maxCbm: number;
  dimensions: string;
  axles: string;
  note: string;
}

/* ═══════════════════════════════════════════════════════
   Default Data (Offline Fallback)
   ═══════════════════════════════════════════════════════ */

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1xamFX-wJdx0A5fy1XLn6_1xTia-OvQgrTGT3KrAw8_I/export?format=csv';

const DEFAULT_VEHICLES: Vehicle[] = [
  { rank: 1, type: "4 ล้อ (ตู้มาตรฐาน)", maxWeight: 1500, maxCbm: 6, dimensions: "2.3 x 1.7 x 2.1 m", axles: "4 ล้อ", note: "" },
  { rank: 2, type: "4 ล้อ (Jumbo/Extended)", maxWeight: 2200, maxCbm: 9, dimensions: "3.1 x 1.7 x 2.2 m", axles: "4 ล้อ", note: "" },
  { rank: 3, type: "6 ล้อ (5.5m)", maxWeight: 5000, maxCbm: 20, dimensions: "5.5 x 2.3 x 2.3 m", axles: "6 ล้อ", note: "" },
  { rank: 4, type: "6 ล้อ (7.2m)", maxWeight: 8000, maxCbm: 30, dimensions: "7.2 x 2.4 x 2.4 m", axles: "6 ล้อ", note: "" },
  { rank: 5, type: "10 ล้อ (7.6m)", maxWeight: 15000, maxCbm: 33, dimensions: "7.6 x 2.4 x 2.5 m", axles: "10 ล้อ", note: "" },
  { rank: 6, type: "10 ล้อ (9.6m)", maxWeight: 16000, maxCbm: 45, dimensions: "9.6 x 2.4 x 2.5 m", axles: "10 ล้อ", note: "" },
  { rank: 7, type: "10 ล้อพ่วง (แม่-ลูก)", maxWeight: 28000, maxCbm: 110, dimensions: "แม่: 6.5m / ลูก: 6.5m", axles: "18-22 ล้อ", note: "เน้นปริมาตร CBM สูงสุด (รวม 2 ตู้)" },
  { rank: 8, type: "เทรลเลอร์ 18 ล้อ (Semi-Trailer)", maxWeight: 30000, maxCbm: 50, dimensions: "12.5 x 2.4 x 2.5 m", axles: "18 ล้อ", note: "เน้นสินค้ายาวพิเศษ" },
  { rank: 9, type: "เทรลเลอร์ 22 ล้อ (Full Trailer)", maxWeight: 32000, maxCbm: 60, dimensions: "13.6 x 2.4 x 2.6 m", axles: "22 ล้อ", note: "เน้นน้ำหนักและสินค้ายาวพิเศษ" }
];

const LS_VEHICLES = 'fleet_rec_vehicles';
const LS_SHEET_URL = 'fleet_rec_sheet_url';
const LS_LAST_SYNC = 'fleet_rec_last_sync';

/* ═══════════════════════════════════════════════════════
   App Component
   ═══════════════════════════════════════════════════════ */

export default function App() {
  /* ─── State ─── */
  const [inputMode, setInputMode] = useState<'items' | 'direct'>('items');

  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { id: '1', width: 0, length: 0, height: 0, weight: 0, quantity: 1 }
  ]);

  const [directCbm, setDirectCbm] = useState(0);
  const [directWeight, setDirectWeight] = useState(0);

  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const hasMounted = useRef(false);

  /* ─── CSV Parser ─── */
  const parseCSV = useCallback((text: string): Vehicle[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] || '';
      });
      rows.push(row);
    }

    // Bilingual header resolver
    const getVal = (row: Record<string, string>, keys: string[]): string => {
      const matchingKey = Object.keys(row).find(k =>
        keys.some(key => k.toLowerCase().trim() === key.toLowerCase() || k.trim() === key)
      );
      return matchingKey ? row[matchingKey] : '';
    };

    const mapped: Vehicle[] = rows.map(row => {
      const rankVal = parseInt(getVal(row, ['Rank', 'ลำดับ', 'rank', 'no', 'No']), 10);
      const typeVal = getVal(row, ['Vehicle_Type', 'Vehicle Type', 'ประเภทรถ', 'ประเภท', 'type', 'name', 'Variant']);
      const weightVal = parseFloat(getVal(row, ['Max_Weight_KG', 'Max Weight (kg)', 'Max Weight', 'น้ำหนักสูงสุด', 'maxweight', 'Weight_Limit_KG']));
      const cbmVal = parseFloat(getVal(row, ['Max_CBM', 'Max CBM', 'CBM สูงสุด', 'maxcbm', 'CBM_Capacity', 'ปริมาตร']));
      const dimVal = getVal(row, ['Inner_Dimensions', 'Inner Dimensions (LxWxH)', 'Inner Dimensions', 'ขนาดตู้บรรทุก', 'ขนาด', 'dimensions', 'Dimensions_LxWxH']);
      const axleVal = getVal(row, ['Axles', 'จำนวนล้อ', 'ล้อ', 'axles']);
      const noteVal = getVal(row, ['Note', 'หมายเหตุ', 'note', 'Remark', 'remark']);

      return {
        rank: isNaN(rankVal) ? 99 : rankVal,
        type: typeVal || 'ไม่ระบุประเภท',
        maxWeight: isNaN(weightVal) ? 99999 : weightVal,
        maxCbm: isNaN(cbmVal) ? 999 : cbmVal,
        dimensions: dimVal || '-',
        axles: axleVal || '-',
        note: noteVal || ''
      };
    }).filter(v => v.rank !== 99);

    mapped.sort((a, b) => a.rank - b.rank);
    return mapped;
  }, []);

  /* ─── Sync Function ─── */
  const syncFromSheet = useCallback(async (url: string, silent = false) => {
    if (!url.trim()) return;

    if (!silent) setSyncStatus('loading');
    else setSyncStatus('loading');
    setSyncError('');

    try {
      let csvUrl = '';
      if (url.includes('export?format=csv') || url.includes('pub?output=csv')) {
        csvUrl = url;
      } else {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        } else {
          // Assume raw spreadsheet ID
          csvUrl = `https://docs.google.com/spreadsheets/d/${url.trim()}/export?format=csv`;
        }
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('ไม่สามารถเข้าถึงไฟล์ได้ — ตรวจสอบสิทธิ์การแชร์');
      }

      const csvText = await response.text();
      const parsed = parseCSV(csvText);

      if (parsed.length === 0) {
        throw new Error('ไม่พบข้อมูลรถในตาราง — ตรวจสอบหัวตาราง');
      }

      setVehicles(parsed);
      const now = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      setLastSyncTime(now);

      localStorage.setItem(LS_VEHICLES, JSON.stringify(parsed));
      localStorage.setItem(LS_SHEET_URL, url);
      localStorage.setItem(LS_LAST_SYNC, now);

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: unknown) {
      console.error(err);
      setSyncStatus('error');
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงค์';
      setSyncError(message);
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  }, [parseCSV]);

  /* ─── Mount: load cache + auto-sync ─── */
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const cachedVehicles = localStorage.getItem(LS_VEHICLES);
    const cachedUrl = localStorage.getItem(LS_SHEET_URL);
    const cachedSync = localStorage.getItem(LS_LAST_SYNC);

    if (cachedVehicles) {
      try { setVehicles(JSON.parse(cachedVehicles)); } catch { /* use defaults */ }
    }
    if (cachedSync) setLastSyncTime(cachedSync);

    const urlToSync = cachedUrl || DEFAULT_SHEET_URL;
    setSheetUrl(urlToSync);

    // Auto-sync
    syncFromSheet(urlToSync, true);
  }, [syncFromSheet]);

  /* ─── Calculations ─── */
  const totalCbm = inputMode === 'items'
    ? cargoItems.reduce((acc, item) => acc + ((item.width * item.length * item.height * item.quantity) / 1000000), 0)
    : directCbm;

  const totalWeight = inputMode === 'items'
    ? cargoItems.reduce((acc, item) => acc + (item.weight * item.quantity), 0)
    : directWeight;

  const hasData = totalCbm > 0 || totalWeight > 0;

  /* ─── Vehicle Matching ─── */
  const findRecommendedVehicle = (cbm: number, weight: number): Vehicle | null => {
    const sorted = [...vehicles].sort((a, b) => a.rank - b.rank);
    for (const vehicle of sorted) {
      if (weight <= vehicle.maxWeight && cbm <= vehicle.maxCbm) {
        return vehicle;
      }
    }
    return null;
  };

  const matchedVehicle = hasData ? findRecommendedVehicle(totalCbm, totalWeight) : null;

  /* ─── Cargo Item Handlers ─── */
  const handleAddRow = () => {
    setCargoItems([...cargoItems, {
      id: Date.now().toString(),
      width: 0, length: 0, height: 0, weight: 0, quantity: 1
    }]);
  };

  const handleRemoveRow = (id: string) => {
    if (cargoItems.length <= 1) return;
    setCargoItems(cargoItems.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof CargoItem, value: number) => {
    setCargoItems(cargoItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  /* ─── Settings Actions ─── */
  const handleManualSync = () => syncFromSheet(sheetUrl, false);

  const handleResetDefault = () => {
    if (confirm('รีเซ็ตข้อมูลรถกลับเป็นค่าตั้งต้น?')) {
      setVehicles(DEFAULT_VEHICLES);
      setSheetUrl(DEFAULT_SHEET_URL);
      setLastSyncTime(null);
      localStorage.removeItem(LS_VEHICLES);
      localStorage.removeItem(LS_SHEET_URL);
      localStorage.removeItem(LS_LAST_SYNC);
      setSyncStatus('idle');
    }
  };

  /* ─── Gauge Math ─── */
  const weightPct = matchedVehicle ? Math.min(100, Math.round((totalWeight / matchedVehicle.maxWeight) * 100)) : 0;
  const cbmPct = matchedVehicle ? Math.min(100, Math.round((totalCbm / matchedVehicle.maxCbm) * 100)) : 0;
  const circ = 2 * Math.PI * 38;

  /* ─── Overload Analysis ─── */
  const renderOverloadAnalysis = () => {
    const largest = [...vehicles].sort((a, b) => b.maxWeight - a.maxWeight)[0] || DEFAULT_VEHICLES[8];
    const weightSplit = Math.ceil(totalWeight / largest.maxWeight);
    const cbmSplit = Math.ceil(totalCbm / largest.maxCbm);
    const splitCount = Math.max(weightSplit, cbmSplit);

    return (
      <div className="glass-panel overload-panel animate-slideIn">
        <div className="overload-header">
          <AlertTriangle size={22} />
          <h4>⚠️ สินค้าเกินขีดจำกัดสูงสุด</h4>
        </div>
        <p className="overload-desc">
          น้ำหนัก ({totalWeight.toLocaleString()} กก.) หรือปริมาตร ({totalCbm.toFixed(2)} CBM)
          เกินกว่ารถที่ใหญ่ที่สุด — <strong>{largest.type}</strong>
        </p>

        <div className="split-card">
          <p className="split-label">💡 คำแนะนำ — Smart Split</p>
          <p className="split-value">
            ใช้ {largest.type} จำนวน <span className="split-count">{splitCount} เที่ยว</span>
          </p>
          <div className="split-grid">
            <div>
              <span className="split-metric-label">เฉลี่ยน้ำหนัก/เที่ยว</span>
              <span className="split-metric-value">{(totalWeight / splitCount).toLocaleString(undefined, { maximumFractionDigits: 0 })} กก.</span>
            </div>
            <div>
              <span className="split-metric-label">เฉลี่ย CBM/เที่ยว</span>
              <span className="split-metric-value">{(totalCbm / splitCount).toFixed(2)} CBM</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Sync Status Icon ─── */
  const renderSyncPill = () => {
    if (syncStatus === 'loading') {
      return (
        <div className="status-pill syncing">
          <Loader size={12} className="animate-spin" />
          <span>SYNCING</span>
        </div>
      );
    }
    if (syncStatus === 'success') {
      return (
        <div className="status-pill online">
          <Check size={12} />
          <span>SYNCED</span>
        </div>
      );
    }
    if (syncStatus === 'error') {
      return (
        <div className="status-pill offline">
          <CloudOff size={12} />
          <span>OFFLINE</span>
        </div>
      );
    }
    // idle
    if (lastSyncTime) {
      return (
        <div className="status-pill online">
          <Check size={12} />
          <span>LIVE</span>
        </div>
      );
    }
    return (
      <div className="status-pill offline">
        <CloudOff size={12} />
        <span>STANDALONE</span>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
     JSX Render
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="app-container">
      {/* Ambient Background Glows */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      {/* ─── Header ─── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-icon">
            <Truck className="text-accent" size={22} />
          </div>
          <div>
            <h1 className="premium-text-gradient">FLEET REC</h1>
            <p className="header-subtitle">Smart Vehicle Recommender</p>
          </div>
        </div>
        <div className="header-actions">
          {renderSyncPill()}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn-settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* ─── Input Mode Toggle ─── */}
      <div className="mode-toggle">
        <button
          onClick={() => setInputMode('items')}
          className={`mode-btn ${inputMode === 'items' ? 'active' : ''}`}
        >
          <Layers size={15} />
          <span>คำนวณรายชิ้น</span>
        </button>
        <button
          onClick={() => setInputMode('direct')}
          className={`mode-btn ${inputMode === 'direct' ? 'active' : ''}`}
        >
          <Sliders size={15} />
          <span>กรอกข้อมูลรวม</span>
        </button>
      </div>

      {/* ─── Main Content ─── */}
      <main className="main-content">

        {/* Items Input Mode */}
        {inputMode === 'items' && (
          <section className="section-items">
            <div className="section-header">
              <h2 className="section-title">รายการสินค้า</h2>
              <button onClick={handleAddRow} className="btn-add-row">
                <Plus size={14} />
                <span>เพิ่มสินค้า</span>
              </button>
            </div>

            <div className="items-list">
              {cargoItems.map((item, idx) => {
                const itemCbm = (item.width * item.length * item.height * item.quantity) / 1000000;
                return (
                  <div key={item.id} className="item-card animate-slideIn">
                    <div className="item-card-header">
                      <span className="item-badge">ITEM #{idx + 1}</span>
                      <div className="item-card-meta">
                        <span className="item-cbm-preview">
                          {itemCbm > 0 ? `${itemCbm.toFixed(3)} CBM` : '—'}
                        </span>
                        {cargoItems.length > 1 && (
                          <button onClick={() => handleRemoveRow(item.id)} className="btn-remove" title="ลบรายการ">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="item-fields-3col">
                      <div className="form-group">
                        <label className="form-label">กว้าง (ซม.)</label>
                        <input
                          type="number" min="0" inputMode="decimal"
                          value={item.width || ''}
                          onChange={e => handleUpdateItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                          className="form-input" placeholder="W"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ยาว (ซม.)</label>
                        <input
                          type="number" min="0" inputMode="decimal"
                          value={item.length || ''}
                          onChange={e => handleUpdateItem(item.id, 'length', parseFloat(e.target.value) || 0)}
                          className="form-input" placeholder="L"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">สูง (ซม.)</label>
                        <input
                          type="number" min="0" inputMode="decimal"
                          value={item.height || ''}
                          onChange={e => handleUpdateItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                          className="form-input" placeholder="H"
                        />
                      </div>
                    </div>
                    <div className="item-fields-2col">
                      <div className="form-group">
                        <label className="form-label">น้ำหนัก/ชิ้น (กก.)</label>
                        <input
                          type="number" min="0" step="0.1" inputMode="decimal"
                          value={item.weight || ''}
                          onChange={e => handleUpdateItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                          className="form-input" placeholder="Weight"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">จำนวน (ชิ้น)</label>
                        <input
                          type="number" min="1" inputMode="numeric"
                          value={item.quantity || ''}
                          onChange={e => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                          className="form-input" placeholder="Qty"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Direct Input Mode */}
        {inputMode === 'direct' && (
          <section className="glass-panel section-direct">
            <h2 className="section-title" style={{ marginBottom: 16 }}>สรุปข้อมูลสินค้า</h2>

            <div className="form-group">
              <div className="direct-label-row">
                <label className="form-label no-margin">ปริมาตรรวม (CBM)</label>
                <span className="direct-value accent">{directCbm.toFixed(2)} CBM</span>
              </div>
              <input
                type="number" step="0.1" min="0" max="200" inputMode="decimal"
                value={directCbm || ''}
                onChange={e => setDirectCbm(Math.max(0, parseFloat(e.target.value) || 0))}
                className="form-input form-input-lg"
              />
              <div className="slider-container">
                <input
                  type="range" min="0" max="120" step="0.5"
                  value={directCbm}
                  onChange={e => setDirectCbm(parseFloat(e.target.value))}
                  className="range-slider"
                />
                <div className="slider-labels">
                  <span>0</span><span>60 CBM</span><span>120 CBM</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <div className="direct-label-row">
                <label className="form-label no-margin">น้ำหนักรวม (กก.)</label>
                <span className="direct-value accent">{directWeight.toLocaleString()} กก.</span>
              </div>
              <input
                type="number" min="0" max="50000" inputMode="numeric"
                value={directWeight || ''}
                onChange={e => setDirectWeight(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="form-input form-input-lg"
              />
              <div className="slider-container">
                <input
                  type="range" min="0" max="35000" step="100"
                  value={directWeight}
                  onChange={e => setDirectWeight(parseInt(e.target.value, 10))}
                  className="range-slider"
                />
                <div className="slider-labels">
                  <span>0</span><span>17,500 กก.</span><span>35,000 กก.</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Total Summary ─── */}
        {hasData && (
          <section className="glass-panel summary-panel">
            <h3 className="section-title" style={{ marginBottom: 12 }}>ผลลัพธ์สินค้าทั้งหมด</h3>
            <div className="summary-grid">
              <div className="summary-box">
                <span className="summary-label">ปริมาตรรวม</span>
                <span className="summary-value">{totalCbm.toLocaleString(undefined, { maximumFractionDigits: 3 })} <small>CBM</small></span>
              </div>
              <div className="summary-box">
                <span className="summary-label">น้ำหนักรวม</span>
                <span className="summary-value">{totalWeight.toLocaleString()} <small>กก.</small></span>
              </div>
            </div>
          </section>
        )}

        {/* ─── Empty State ─── */}
        {!hasData && (
          <section className="glass-panel empty-state">
            <PackageOpen size={48} className="empty-icon" />
            <h3>กรอกข้อมูลสินค้า</h3>
            <p>ระบุขนาดและน้ำหนักสินค้าเพื่อดูผลแนะนำประเภทรถ</p>
          </section>
        )}

        {/* ─── Recommendation Result ─── */}
        {hasData && matchedVehicle && (
          <section className="glass-panel result-panel animate-slideIn">
            <div className="result-header">
              <div>
                <p className="result-label">RECOMMENDED VEHICLE</p>
                <h3 className="result-vehicle-name">{matchedVehicle.type}</h3>
              </div>
              <div className="result-rank-badge">RANK {matchedVehicle.rank}</div>
            </div>

            {/* Spec Grid */}
            <div className="spec-grid">
              <div className="spec-item">
                <Maximize className="spec-icon" size={15} />
                <span className="spec-label">ขนาดภายใน</span>
                <span className="spec-value">{matchedVehicle.dimensions}</span>
              </div>
              <div className="spec-item">
                <Scale className="spec-icon" size={15} />
                <span className="spec-label">น้ำหนักสูงสุด</span>
                <span className="spec-value">{matchedVehicle.maxWeight.toLocaleString()} กก.</span>
              </div>
              <div className="spec-item">
                <Truck className="spec-icon" size={15} />
                <span className="spec-label">ล้อ</span>
                <span className="spec-value">{matchedVehicle.axles}</span>
              </div>
            </div>

            {/* Vehicle Note */}
            {matchedVehicle.note && (
              <div className="vehicle-note">
                <AlertTriangle size={13} />
                <span>{matchedVehicle.note}</span>
              </div>
            )}

            {/* Truck Visual */}
            <div className="truck-visual">
              <div className="truck-body">
                <div className="truck-cargo-box">
                  <div className="truck-cargo-fill" style={{ height: `${Math.max(weightPct, cbmPct)}%` }} />
                  <span className="truck-cargo-label">CARGO</span>
                </div>
                <div className="truck-cabin" />
                <div className="truck-wheel wheel-1" />
                <div className="truck-wheel wheel-2" />
                <div className="truck-wheel wheel-3" />
                {matchedVehicle.rank >= 5 && <div className="truck-wheel wheel-4" />}
              </div>
            </div>

            {/* Gauges */}
            <div className="gauge-grid">
              <div className="gauge-card">
                <div className="gauge-circle">
                  <svg className="gauge-svg" viewBox="0 0 90 90">
                    <circle className="gauge-bg" cx="45" cy="45" r="38" />
                    <circle
                      className="gauge-bar"
                      cx="45" cy="45" r="38"
                      stroke={weightPct > 90 ? '#ef4444' : '#b60900'}
                      strokeDasharray={circ}
                      strokeDashoffset={circ - (weightPct / 100) * circ}
                    />
                  </svg>
                  <span className="gauge-pct">{weightPct}%</span>
                </div>
                <p className="gauge-label">น้ำหนักบรรทุก</p>
                <p className="gauge-detail">{totalWeight.toLocaleString()} / {matchedVehicle.maxWeight.toLocaleString()} กก.</p>
              </div>

              <div className="gauge-card">
                <div className="gauge-circle">
                  <svg className="gauge-svg" viewBox="0 0 90 90">
                    <circle className="gauge-bg" cx="45" cy="45" r="38" />
                    <circle
                      className="gauge-bar"
                      cx="45" cy="45" r="38"
                      stroke={cbmPct > 90 ? '#ef4444' : '#b60900'}
                      strokeDasharray={circ}
                      strokeDashoffset={circ - (cbmPct / 100) * circ}
                    />
                  </svg>
                  <span className="gauge-pct">{cbmPct}%</span>
                </div>
                <p className="gauge-label">พื้นที่ CBM</p>
                <p className="gauge-detail">{totalCbm.toFixed(1)} / {matchedVehicle.maxCbm.toFixed(1)} CBM</p>
              </div>
            </div>
          </section>
        )}

        {/* ─── Overload ─── */}
        {hasData && !matchedVehicle && renderOverloadAnalysis()}

      </main>

      {/* ─── Settings Drawer Backdrop ─── */}
      <div className={`drawer-backdrop ${isSettingsOpen ? 'open' : ''}`} onClick={() => setIsSettingsOpen(false)} />

      {/* ─── Settings Drawer ─── */}
      <div className={`settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <Settings size={18} className="text-primary" />
            <h3>ตั้งค่าแหล่งข้อมูล</h3>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="btn-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Last Sync Info */}
          {lastSyncTime && (
            <div className="sync-info-bar">
              <Check size={14} />
              <span>ซิงค์ล่าสุด: {lastSyncTime} — {vehicles.length} รายการรถ</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">ลิงก์ Google Sheet (แชร์เป็นสาธารณะ)</label>
            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="วางลิงก์ Google Sheet ที่นี่..."
              className="form-input"
            />
          </div>

          {syncError && (
            <div className="sync-error">
              <AlertTriangle size={14} />
              <span>{syncError}</span>
            </div>
          )}

          <div className="drawer-actions">
            <button onClick={handleResetDefault} className="btn-reset">
              รีเซ็ตค่าตั้งต้น
            </button>
            <button
              onClick={handleManualSync}
              disabled={syncStatus === 'loading'}
              className="btn-sync"
            >
              {syncStatus === 'loading' ? (
                <><RefreshCw size={14} className="animate-spin" /> กำลังซิงค์...</>
              ) : (
                <><RefreshCw size={14} /> ซิงค์ข้อมูล</>
              )}
            </button>
          </div>

          <div className="drawer-help">
            <span className="drawer-help-title">📋 วิธีตั้งค่า Google Sheet:</span>
            <ol>
              <li>เปิด Google Sheet ที่ต้องการ</li>
              <li>กดเมนู <strong>แชร์ (Share)</strong> → เปลี่ยนสิทธิ์เป็น <strong>"ทุกคนที่มีลิงก์"</strong></li>
              <li>คัดลอกลิงก์มาวางในช่องด้านบน แล้วกด <strong>"ซิงค์ข้อมูล"</strong></li>
            </ol>
            <p>ระบบจะซิงค์ข้อมูลอัตโนมัติทุกครั้งที่เปิดแอป</p>
          </div>
        </div>
      </div>
    </div>
  );
}
