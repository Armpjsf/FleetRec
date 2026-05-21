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
  Loader,
  Coins,
  Calculator,
  Info,
  Droplet,
  Shield,
  Lock,
  Unlock,
  Fingerprint,
  AlertOctagon,
  Terminal,
  Activity
} from 'lucide-react';
import pricingMatrix from './pricing_matrix.json';

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
  /* ─── Security & Device ID Initialization ─── */
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('fleet_rec_device_id');
    if (!id) {
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      id = `FR-${code}`;
      localStorage.setItem('fleet_rec_device_id', id);
    }
    return id;
  });

  /* ─── Security & Authentication State ─── */
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('fleet_rec_is_auth') === 'true';
  });
  
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    name: string;
    role: string;
    ip: string;
    deviceFingerprint: string;
    deviceOS: string;
    deviceBrowser: string;
  } | null>(() => {
    const cached = localStorage.getItem('fleet_rec_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [securityLogs, setSecurityLogs] = useState<Array<{
    id: string;
    time: string;
    event: string;
    email: string;
    ip: string;
    status: 'success' | 'warn' | 'blocked';
    device: string;
  }>>(() => {
    const cached = localStorage.getItem('fleet_rec_sec_logs');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: '1',
        time: new Date(Date.now() - 3600000).toLocaleString('th-TH'),
        event: 'เกราะความปลอดภัยได้รับการติดตั้งสำเร็จ (DLP Shield Initialized)',
        email: 'system',
        ip: '127.0.0.1',
        status: 'success',
        device: 'FleetRec Security System'
      }
    ];
  });

  const [isFingerprintMismatched, setIsFingerprintMismatched] = useState<boolean>(false);
  const [isWatermarkTampered, setIsWatermarkTampered] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSecurityCenterOpen, setIsSecurityCenterOpen] = useState<boolean>(false);

  // Sync security logs to localStorage
  useEffect(() => {
    localStorage.setItem('fleet_rec_sec_logs', JSON.stringify(securityLogs));
  }, [securityLogs]);

  // MutationObserver to protect watermark from Inspect Element tampering
  useEffect(() => {
    if (!isAuthenticated || !currentUser || isFingerprintMismatched) return;

    const targetId = 'secure-watermark-overlay';
    
    // Timer fallback check in case MutationObserver is bypassed or blocked
    const fallbackInterval = setInterval(() => {
      const el = document.getElementById(targetId);
      if (!el) {
        setIsWatermarkTampered(true);
        return;
      }
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) === 0 ||
        style.pointerEvents !== 'none'
      ) {
        setIsWatermarkTampered(true);
      }
    }, 1000);

    const observer = new MutationObserver((mutations) => {
      let tampered = false;
      for (const mutation of mutations) {
        // Element deleted
        if (mutation.type === 'childList') {
          const el = document.getElementById(targetId);
          if (!el) tampered = true;
        }
        // Style altered
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const el = document.getElementById(targetId);
          if (el) {
            const style = window.getComputedStyle(el);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              parseFloat(style.opacity) === 0 ||
              style.pointerEvents !== 'none'
            ) {
              tampered = true;
            }
          } else {
            tampered = true;
          }
        }
      }
      if (tampered) {
        setIsWatermarkTampered(true);
        // Log watermark tampering attempt
        const tamperingLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleString('th-TH'),
          event: `แจ้งเตือนความปลอดภัยสูง: ตรวจพบการพยายามแทรกแซงหรือลบลายน้ำหน้าจอผ่านโค้ด!`,
          email: currentUser?.email || 'unknown',
          ip: currentUser?.ip || '127.0.0.1',
          status: 'warn' as const,
          device: 'DevTools DOM Inspector'
        };
        setSecurityLogs(prev => [tamperingLog, ...prev]);
      }
    });

    const config = { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] };
    const bodyEl = document.body;
    observer.observe(bodyEl, config);

    return () => {
      observer.disconnect();
      clearInterval(fallbackInterval);
    };
  }, [isAuthenticated, currentUser, isFingerprintMismatched]);

  // Helper to parse emails sheet CSV
  const parseEmailsCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

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

    const cleanCell = (cell: string) => {
      let clean = cell.trim();
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.substring(1, clean.length - 1);
      }
      return clean;
    };

    const headers = parseLine(lines[0]).map(h => cleanCell(h).toLowerCase());
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = parseLine(lines[i]).map(c => cleanCell(c));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] || '';
      });
      rows.push(row);
    }
    return rows;
  };

  // Auth Operations
  const handleLogin = async (email: string) => {
    setIsAuthenticating(true);
    setLoginError('');
    
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setLoginError('กรุณากรอกอีเมลองค์กร');
      setIsAuthenticating(false);
      return;
    }

    let isAuthorized = false;
    let isDeviceAuthorized = true;
    let name = 'พนักงานทั่วไป';
    let role = 'Sales Rep';
    let isFetchedSheet = false;
    let sheetDeviceIdsString = '';

    // 1. Try to query Google Sheets tab 'Emails' if sheetUrl is configured
    try {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const spreadSheetId = match[1];
        // gviz query to fetch a specific sheet tab by name 'Emails'
        const emailsCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadSheetId}/gviz/tq?tqx=out:csv&sheet=Emails`;
        
        const res = await fetch(emailsCsvUrl);
        if (res.ok) {
          const csvText = await res.text();
          const emailRows = parseEmailsCSV(csvText);
          
          if (emailRows.length > 0) {
            isFetchedSheet = true;
            
            const matchedRow = emailRows.find(row => {
              const emailKey = Object.keys(row).find(k => k === 'email' || k === 'อีเมล');
              if (emailKey) {
                return row[emailKey].toLowerCase().trim() === emailTrim;
              }
              return Object.values(row).some(val => val.toLowerCase().trim() === emailTrim);
            });

            if (matchedRow) {
              isAuthorized = true;
              const nameKey = Object.keys(matchedRow).find(k => k === 'name' || k === 'ชื่อ' || k === 'ชื่อพนักงาน');
              const roleKey = Object.keys(matchedRow).find(k => k === 'role' || k === 'ตำแหน่ง' || k === 'บทบาท');
              const deviceKey = Object.keys(matchedRow).find(k => k === 'device id' || k === 'device_id' || k === 'ไอดีเครื่อง' || k === 'ไอดีอุปกรณ์' || k === 'อุปกรณ์' || k === 'เครื่อง');
              
              name = nameKey ? matchedRow[nameKey] : `คุณ${emailTrim.split('@')[0]}`;
              role = roleKey ? matchedRow[roleKey] : 'Sales Rep';

              if (deviceKey && matchedRow[deviceKey].trim()) {
                sheetDeviceIdsString = matchedRow[deviceKey];
                // Split by commas, slashes, or semicolons to support multiple IDs
                const allowedDevices = matchedRow[deviceKey]
                  .split(/[,/;]+/)
                  .map(d => d.trim().toUpperCase())
                  .filter(Boolean);
                
                if (allowedDevices.length > 0) {
                  // Check if current deviceId (uppercase) is in the allowed list
                  isDeviceAuthorized = allowedDevices.includes(deviceId.toUpperCase());
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to query Emails sheet tab, falling back to default logic', e);
    }

    // 2. Resolve authentication based on verification outcome
    if (isFetchedSheet) {
      if (!isAuthorized) {
        setLoginError('ลงชื่อเข้าใช้ล้มเหลว: อีเมลนี้ไม่ได้รับอนุญาตให้เข้าใช้งานระบบ (ระบุใน Google Sheet Whitelist)');
        
        const failedLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleString('th-TH'),
          event: `ปฏิเสธสิทธิ์การเปิดใช้: อีเมลไม่พบในรายชื่อผู้มีสิทธิ์ใน Google Sheets (${emailTrim})`,
          email: emailTrim,
          ip: '182.52.19.124',
          status: 'blocked' as const,
          device: 'Chrome 124 (Windows 11)'
        };
        setSecurityLogs(prev => [failedLog, ...prev]);
        setIsAuthenticating(false);
        return;
      }

      if (!isDeviceAuthorized) {
        setLoginError(`ลงชื่อเข้าใช้ล้มเหลว: อุปกรณ์เครื่องนี้ (${deviceId}) ยังไม่ได้รับการอนุมัติ กรุณาแจ้งให้ผู้ดูแลระบบลงทะเบียนรหัสเครื่องนี้ในคอลัมน์ "ไอดีเครื่อง" ของ Google Sheet Emails (สามารถลงได้หลายรหัส คั่นด้วยเครื่องหมายจุลภาค , )`);
        
        const failedLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleString('th-TH'),
          event: `ปฏิเสธเครื่องแปลกปลอม: อีเมลพบบนตาราง แต่ไอดีเครื่อง (${deviceId}) ไม่ตรงกับรายการอนุมัติ (${sheetDeviceIdsString})`,
          email: emailTrim,
          ip: '182.52.19.124',
          status: 'blocked' as const,
          device: `Blocked Device (${deviceId})`
        };
        setSecurityLogs(prev => [failedLog, ...prev]);
        setIsAuthenticating(false);
        return;
      }
    } else {
      // Fallback 2a. Allow preconfigured threat simulator email
      if (emailTrim === 'competitor.spy@gmail.com') {
        setLoginError('ลงชื่อเข้าใช้ล้มเหลว: อีเมลนี้เป็นบัญชีจำลองภัยคุกคาม ไม่อนุญาตให้เปิดใช้งาน');
        setIsAuthenticating(false);
        return;
      }
      
      // Fallback 2b. Restrict by domain @fleetrec.co.th
      if (!emailTrim.endsWith('@fleetrec.co.th')) {
        setLoginError('ลงชื่อเข้าใช้ล้มเหลว: ไม่อนุญาตโดเมนอื่น อนุญาตเฉพาะโดเมนองค์กร (@fleetrec.co.th) เท่านั้น');
        
        const newLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleString('th-TH'),
          event: `ปฏิเสธสิทธิ์การเปิดใช้: พยายามสวมสิทธิ์ผ่านอีเมลภายนอก (${emailTrim})`,
          email: emailTrim,
          ip: '203.150.19.12',
          status: 'warn' as const,
          device: 'Safari / Mobile (Unknown Device)'
        };
        setSecurityLogs(prev => [newLog, ...prev]);
        setIsAuthenticating(false);
        return;
      }

      // Assign default names for simulation accounts
      if (emailTrim.startsWith('chatchai')) {
        name = 'คุณชัชชัย ศรีสวัสดิ์';
        role = 'Sales Representative';
      } else if (emailTrim.startsWith('wanida')) {
        name = 'คุณวนิดา เกียรติสกุล';
        role = 'Logistics Manager';
      } else if (emailTrim.startsWith('panya')) {
        name = 'คุณปัญญา เลิศพัฒนา';
        role = 'System Administrator';
      } else {
        const prefix = emailTrim.split('@')[0];
        name = `คุณ${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (ฝ่ายขาย)`;
      }
    }

    // Success Authentication
    const userIP = '182.52.19.124';
    const userFingerprint = deviceId;
    const userData = {
      email: emailTrim,
      name,
      role,
      ip: userIP,
      deviceFingerprint: userFingerprint,
      deviceOS: 'Windows 11',
      deviceBrowser: 'Chrome 124.0'
    };

    localStorage.setItem('fleet_rec_is_auth', 'true');
    localStorage.setItem('fleet_rec_user', JSON.stringify(userData));
    
    const newLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleString('th-TH'),
      event: `ล็อกอินสำเร็จ: รหัสเครื่องอนุมัติถูกต้อง และลงทะเบียนผูกลายนิ้วมือบราวเซอร์แล้ว ${isFetchedSheet ? '(ยืนยันสิทธิ์ผ่าน Google Sheet)' : '(ยืนยันผ่านระบบสแตนดาร์ด)'}`,
      email: emailTrim,
      ip: userIP,
      status: 'success' as const,
      device: `Windows 11 (Chrome 124) [${deviceId}]`
    };

    setSecurityLogs(prev => [newLog, ...prev]);
    setCurrentUser(userData);
    setIsAuthenticated(true);
    setIsAuthenticating(false);
    setIsFingerprintMismatched(false);
  };

  const handleLogout = () => {
    if (currentUser) {
      const newLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleString('th-TH'),
        event: `ออกจากระบบ: ยกเลิกการเชื่อมโยงเซสชันอย่างปลอดภัย`,
        email: currentUser.email,
        ip: currentUser.ip,
        status: 'success' as const,
        device: `${currentUser.deviceOS} (${currentUser.deviceBrowser})`
      };
      setSecurityLogs(prev => [newLog, ...prev]);
    }
    
    localStorage.removeItem('fleet_rec_is_auth');
    localStorage.removeItem('fleet_rec_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsFingerprintMismatched(false);
  };

  const triggerFingerprintHijackSimulation = () => {
    if (!currentUser) return;
    
    const intruderIP = '203.150.19.12';
    const intruderFingerprint = 'FP-MAC-SAF-9912';
    const intruderDevice = 'macOS Ventura (Safari 17)';
    
    const warningLog = {
      id: Date.now().toString() + '-w',
      time: new Date().toLocaleString('th-TH'),
      event: `ตรวจพบการละเมิด: พยายามแชร์ลิงก์หรือรหัสผ่าน! ตรวจสอบพบลายนิ้วมือเครื่องแปลกปลอม (${intruderFingerprint}) เข้าสวมสิทธิ์`,
      email: currentUser.email,
      ip: intruderIP,
      status: 'warn' as const,
      device: intruderDevice
    };

    const blockedLog = {
      id: Date.now().toString() + '-b',
      time: new Date().toLocaleString('th-TH'),
      event: `ปิดกั้นถาวร (DLP Locked): ระบบทำการล็อกหน้าจอแอปเครื่องผู้บุกรุก (${intruderFingerprint}) และส่งบันทึกความปลอดภัยเข้าเซิร์ฟเวอร์`,
      email: currentUser.email,
      ip: intruderIP,
      status: 'blocked' as const,
      device: intruderDevice
    };

    setSecurityLogs(prev => [blockedLog, warningLog, ...prev]);
    setIsFingerprintMismatched(true);
  };

  const resetFingerprintSimulation = () => {
    setIsFingerprintMismatched(false);
    if (currentUser) {
      const recoverLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleString('th-TH'),
        event: `ปลดล็อกระบบ: ยืนยันตัวตนสำเร็จผ่านอุปกรณ์ของพนักงานที่ปลอดภัย`,
        email: currentUser.email,
        ip: currentUser.ip,
        status: 'success' as const,
        device: `${currentUser.deviceOS} (${currentUser.deviceBrowser})`
      };
      setSecurityLogs(prev => [recoverLog, ...prev]);
    }
  };

  const handleClearLogs = () => {
    if (confirm('ยืนยันการล้างประวัติการแจ้งเตือนความปลอดภัยทั้งหมด?')) {
      const defaultLog = [{
        id: '1',
        time: new Date().toLocaleString('th-TH'),
        event: 'ล้างบันทึกความปลอดภัย — เริ่มต้นระบบการเก็บบันทึกใหม่',
        email: currentUser?.email || 'system',
        ip: currentUser?.ip || '127.0.0.1',
        status: 'success' as const,
        device: 'Secure Logger'
      }];
      setSecurityLogs(defaultLog);
    }
  };

  /* ─── State ─── */
  const [activeTab, setActiveTab] = useState<'recommender' | 'pricing'>('recommender');

  // Pricing Calculator State
  const [pricingVehicleType, setPricingVehicleType] = useState<'4' | '6' | '10'>('6');
  const [pricingDistance, setPricingDistance] = useState<number | ''>('');
  const [pricingExtraLift, setPricingExtraLift] = useState<number | ''>('');
  const [pricingExtraMove, setPricingExtraMove] = useState<number | ''>('');
  const [pricingExtraOther, setPricingExtraOther] = useState<number | ''>('');
  const [pricingProfitMode, setPricingProfitMode] = useState<'%' | '฿'>('%');
  const [pricingProfitValue, setPricingProfitValue] = useState<number | ''>(15);

  // Oil Price State
  const [oilPrice, setOilPrice] = useState<number | null>(null);
  const [oilDate, setOilDate] = useState<string | null>(null);

  const fetchOilPrice = useCallback(async () => {
    const apiUrL = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrL)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrL)}`,
      apiUrL
    ];

    for (let i = 0; i < proxies.length; i++) {
      try {
        const response = await fetch(proxies[i]);
        if (!response.ok) continue;

        let data;
        if (proxies[i].includes('allorigins.win/get')) {
          const wrapper = await response.json();
          data = JSON.parse(wrapper.contents);
        } else {
          data = await response.json();
        }

        if (Array.isArray(data) && data.length > 0 && data[0].OilList) {
          const oilList = typeof data[0].OilList === 'string' ? JSON.parse(data[0].OilList) : data[0].OilList;
          const diesel = oilList.find((o: any) => o.OilName === 'ไฮดีเซล S') ||
                         oilList.find((o: any) => o.OilName.includes('ไฮดีเซล')) ||
                         oilList.find((o: any) => o.OilName === 'ดีเซล' || (o.OilName.includes('ดีเซล') && !o.OilName.includes('B20') && !o.OilName.includes('พรีเมียม')));
          if (diesel) {
            setOilPrice(Number(diesel.PriceToday));
            setOilDate(data[0].OilRemark2 || data[0].OilPriceDate || 'วันนี้');
            return;
          }
        }
      } catch (err) {
        console.warn(`Proxy ${i} failed:`, err);
      }
    }
    setOilPrice(35.20);
    setOilDate('ราคาสแตนดาร์ดสำรอง');
  }, []);

  useEffect(() => {
    fetchOilPrice();
  }, [fetchOilPrice]);

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

  /* ─── Pricing Calculations ─── */
  const getOilRangeIndex = (price: number): number => {
    if (price <= 27) return 0;
    if (price <= 30) return 1;
    if (price <= 33) return 2;
    if (price <= 36) return 3;
    if (price <= 39) return 4;
    if (price <= 42) return 5;
    if (price <= 45) return 6;
    if (price <= 48) return 7;
    if (price <= 51) return 8;
    return 9;
  };

  const oilRangeIndex = oilPrice !== null ? getOilRangeIndex(oilPrice) : 2; // Default to index 2 (30.01-33)

  const pricingDistanceNum = Number(pricingDistance) || 0;
  const pricingRoundedDist = Math.min(3000, Math.ceil(pricingDistanceNum / 50) * 50);

  let pricingBaseCosts: number[] | null = null;
  if (pricingRoundedDist > 0 && (pricingMatrix.matrix as any)[pricingVehicleType]) {
    pricingBaseCosts = (pricingMatrix.matrix as any)[pricingVehicleType][pricingRoundedDist.toString()] || null;
  }

  const pricingExtraCosts = (Number(pricingExtraLift) || 0) +
                            (Number(pricingExtraMove) || 0) +
                            (Number(pricingExtraOther) || 0);

  interface PricingPeriodResult {
    range: string;
    baseCost: number;
    totalCost: number;
    recommendedPrice: number;
    isCurrent: boolean;
  }

  const pricingResults: PricingPeriodResult[] = [];
  const oilRanges = pricingMatrix.oil_ranges;

  if (pricingBaseCosts && pricingBaseCosts.length === 10) {
    for (let i = 0; i < 10; i++) {
      const baseCost = pricingBaseCosts[i];
      const totalCost = Math.floor(baseCost + pricingExtraCosts);
      
      let profit = 0;
      if (pricingProfitValue !== '') {
        if (pricingProfitMode === '%') {
          profit = totalCost * (Number(pricingProfitValue) / 100);
        } else {
          profit = Number(pricingProfitValue);
        }
      }
      const recommendedPrice = Math.floor(totalCost + profit);
      
      pricingResults.push({
        range: oilRanges[i],
        baseCost,
        totalCost,
        recommendedPrice,
        isCurrent: i === oilRangeIndex
      });
    }
  }

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
  // Security Screens Conditionals
  if (isWatermarkTampered) {
    return (
      <div className="security-tamper-screen">
        <div className="tamper-card">
          <div className="tamper-icon-container">
            <AlertOctagon size={48} className="text-accent animate-pulse" />
          </div>
          <h2 className="premium-text-gradient">SECURITY SYSTEM LOCKED</h2>
          <h3>ตรวจพบการพยายามทำลายกลไกป้องกัน (DLP Violations)</h3>
          <p className="tamper-desc">
            ระบบความปลอดภัย FleetRec ตรวจพบว่ามีความพยายามลบ ซ่อน หรือดัดแปลง <strong>ลายน้ำความปลอดภัยบนจอภาพ (Watermark Layer)</strong> 
            ผ่านชุดคำสั่งตรวจสอบโค้ดของเว็บบราวเซอร์ (Chrome DevTools / Inspect Element) 
            เครื่องของคุณถูกระงับสิทธิ์ชั่วคราวเพื่อป้องกันการรั่วไหลของข้อมูลตารางราคาความลับองค์กร
          </p>
          
          <div className="tamper-meta">
            <div className="meta-row"><span>พนักงาน:</span> <strong>{currentUser?.email || 'ไม่ได้ระบุ'}</strong></div>
            <div className="meta-row"><span>ที่อยู่เครือข่าย IP:</span> <strong>{currentUser?.ip || '127.0.0.1'}</strong></div>
            <div className="meta-row"><span>เวลาเกิดเหตุ:</span> <strong>{new Date().toLocaleString('th-TH')}</strong></div>
          </div>
          
          <div className="security-actions">
            <button 
              onClick={() => {
                setIsWatermarkTampered(false);
                handleLogout();
              }} 
              className="btn-security-reset"
            >
              <RefreshCw size={14} />
              <span>ยืนยันตัวตนใหม่เพื่อปลดล็อกสิทธิ์</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isFingerprintMismatched) {
    return (
      <div className="security-hijack-screen">
        <div className="hijack-card">
          <div className="hijack-icon-container">
            <Shield size={48} className="text-accent animate-bounce" />
          </div>
          <h2 className="premium-text-gradient">SUSPICIOUS SESSION BLOCKED</h2>
          <h3>ตรวจพบลักษณะการแชร์ลิงก์หรือรหัสผ่านให้คนนอก</h3>
          <p className="hijack-desc">
            ระบบ DLP ตรวจพบพฤติกรรมความผิดปกติ เนื่องจากบัญชีของท่านได้รับการเข้าใช้งานบนอุปกรณ์เครื่องอื่น 
            <strong>ลายนิ้วมือเครื่องบราวเซอร์ (Device Fingerprint) และ IP ปลายทางไม่ตรงกับพนักงานเจ้าของสิทธิ์</strong> 
            ระบบได้ทำการปิดกั้นสิทธิ์การเข้าถึงข้อมูลตารางราคาโดยทันที
          </p>

          <div className="hijack-comparison">
            <div className="comparison-box authorized">
              <h4>🟢 อุปกรณ์ที่ได้รับอนุญาตของพนักงาน</h4>
              <ul>
                <li><span>พนักงาน:</span> {currentUser?.name}</li>
                <li><span>อีเมล:</span> {currentUser?.email}</li>
                <li><span>อุปกรณ์:</span> Windows 11 (Chrome 124)</li>
                <li><span>ที่อยู่ IP:</span> 182.52.19.124</li>
                <li><span>สถานะ:</span> ลงทะเบียนสิทธิ์แล้ว</li>
              </ul>
            </div>
            <div className="comparison-box unauthorized">
              <h4>🔴 อุปกรณ์แปลกปลอมที่พยายามสวมรอย</h4>
              <ul>
                <li><span>พนักงานนอก:</span> อุปกรณ์ภายนอกแชร์ลิงก์</li>
                <li><span>อุปกรณ์:</span> macOS Ventura (Safari 17)</li>
                <li><span>ที่อยู่ IP:</span> 203.150.19.12 (Bangkok)</li>
                <li><span>สถานะ:</span> <strong>ปิดกั้นสิทธิ์ (Blocked)</strong></li>
              </ul>
            </div>
          </div>

          <div className="security-notice">
            <Info size={14} className="text-accent" />
            <p>
              เซสชันของระบบคำนวณราคากลางเป็นของส่วนบุคคล การส่งต่อหน้าจอหรือข้อมูลราคาให้บริษัทคู่แข่งหรือบุคคลภายนอก 
              มีความผิดร้ายแรงตามนโยบายรักษาความปลอดภัยของบริษัท ระบบได้ส่งข้อมูลบันทึกความปลอดภัยชุดนี้ไปยัง Compliance Team แล้ว
            </p>
          </div>

          <div className="security-actions">
            <button 
              onClick={resetFingerprintSimulation} 
              className="btn-security-reset"
            >
              <RefreshCw size={14} />
              <span>กู้คืนอุปกรณ์ปลอดภัยเพื่อทดลองต่อ (Reset Simulation)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="ambient-glow glow-1" />
        <div className="ambient-glow glow-2" />
        
        <div className="login-card animate-slideIn">
          <div className="login-logo-container">
            <div className="login-logo-icon">
              <Shield size={36} className="text-accent" />
            </div>
            <h1 className="premium-text-gradient">FLEET REC</h1>
            <p className="login-logo-sub">SECURE CORPORATE PORTAL</p>
          </div>
          
          <h2 className="login-title">ระบบประเมินราคาและควบคุมสิทธิ์ความปลอดภัย</h2>
          <p className="login-desc">
            ข้อมูลตารางต้นทุนขนส่งและอัตรากำไรจัดเป็นความลับระดับสูงสุดขององค์กร 
            กรุณายืนยันตัวตนด้วยบัญชีอีเมลบริษัทของคุณเพื่อเชื่อมสิทธิ์ล็อกอินปลอดภัยชั้นสูง
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(loginEmail); }} className="login-form">
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">อีเมลองค์กรของคุณ</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="ชื่อพนักงาน@fleetrec.co.th"
                className="form-input login-input"
                disabled={isAuthenticating}
                style={{ width: '100%' }}
              />
            </div>

            {/* 🖥️ Dynamic Browser/Device ID Display (Multiple Device Support) */}
            <div className="device-id-badge-container" style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Fingerprint size={16} className="text-accent animate-pulse" />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ไอดีอุปกรณ์เครื่องนี้ (Device ID)</span>
                  <strong style={{ color: 'var(--foreground)', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.05em' }}>{deviceId}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(deviceId);
                  alert(`คัดลอกไอดีเครื่องสำเร็จ: ${deviceId}\n\nคุณสามารถนำไอดีนี้ไปบันทึกร่วมกับไอดีอื่น ๆ ของคุณในช่อง "ไอดีเครื่อง" (คั่นด้วยเครื่องหมายจุลภาค , ) ในตาราง Google Sheet เพื่อให้เครื่องนี้สามารถเข้าใช้งานได้ครับ!`);
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: 'var(--success)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                คัดลอก (Copy)
              </button>
            </div>

            {loginError && (
              <div className="login-error-box">
                <AlertTriangle size={14} className="error-icon" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="btn-login"
            >
              {isAuthenticating ? (
                <><Loader size={16} className="animate-spin" /> กำลังประมวลผลสิทธิ์...</>
              ) : (
                <><Lock size={16} /> ยืนยันตัวตนเข้าระบบ SSO</>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 🛡️ Dynamic Screen Watermark (DLP Protection Layer) */}
      <div 
        id="secure-watermark-overlay" 
        className="secure-watermark-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          pointerEvents: 'none',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          gap: '20px',
          padding: '20px',
          opacity: 0.04,
          userSelect: 'none',
          transform: 'rotate(-15deg) scale(1.15)',
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <div 
            key={i} 
            className="watermark-item"
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--foreground)',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              letterSpacing: '0.04em'
            }}
          >
            {currentUser?.email} | IP: {currentUser?.ip} | CONFIDENTIAL
          </div>
        ))}
      </div>

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
          {oilPrice !== null && (
            <div className="oil-price-pill" title={`อัปเดตล่าสุด: ${oilDate}`}>
              <Droplet size={14} className="text-accent animate-pulse" />
              <span className="oil-price-text">ดีเซล {oilPrice.toFixed(2)} บ.</span>
            </div>
          )}

          <button
            onClick={() => setIsSecurityCenterOpen(true)}
            className="btn-security-center"
            title="เปิดแผงควบคุมสิทธิ์ความปลอดภัย DLP"
            style={{
              padding: '10px',
              borderRadius: 'var(--radius)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: 'var(--success)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              marginRight: '2px'
            }}
          >
            <Shield size={16} className="animate-pulse" />
          </button>

          {renderSyncPill()}
          
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="btn-settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={handleLogout}
            className="btn-logout"
            title="ออกจากระบบ"
            style={{
              padding: '10px',
              borderRadius: 'var(--radius)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              color: 'var(--error)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              marginLeft: '2px'
            }}
          >
            <Unlock size={16} />
          </button>
        </div>
      </header>

      {/* ─── Tabs Navigation ─── */}
      <div className="main-tabs">
        <button
          onClick={() => setActiveTab('recommender')}
          className={`main-tab-btn ${activeTab === 'recommender' ? 'active' : ''}`}
        >
          <Truck size={16} />
          <span>🚚 ค้นหารถที่เหมาะสม</span>
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`main-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
        >
          <Coins size={16} />
          <span>💰 คำนวณต้นทุน & ราคาขาย</span>
        </button>
      </div>

      {/* ─── Recommender Tab ─── */}
      {activeTab === 'recommender' && (
        <>
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
              <div className="result-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="result-rank-badge" style={{ margin: 0 }}>RANK {matchedVehicle.rank}</div>
                {(() => {
                  let wheelType: '4' | '6' | '10' = '6';
                  if (matchedVehicle.axles.includes('4') || matchedVehicle.type.includes('4 ล้อ')) wheelType = '4';
                  else if (matchedVehicle.axles.includes('6') || matchedVehicle.type.includes('6 ล้อ')) wheelType = '6';
                  else if (matchedVehicle.axles.includes('10') || matchedVehicle.type.includes('10 ล้อ')) wheelType = '10';
                  
                  return (
                    <button
                      onClick={() => {
                        setPricingVehicleType(wheelType);
                        setActiveTab('pricing');
                      }}
                      className="btn-carryover"
                      title="ส่งไปคำนวณเงินค่าจัดส่งและเสนอราคาต่อ"
                    >
                      <Coins size={13} />
                      <span>คำนวณราคาต่อ</span>
                    </button>
                  );
                })()}
              </div>
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
      </>
      )}

      {/* ─── Pricing Calculator Tab ─── */}
      {activeTab === 'pricing' && (
        <main className="main-content animate-slideIn">
          <section className="glass-panel pricing-input-panel">
            <h2 className="section-title" style={{ marginBottom: 16 }}>💰 ตัวกรองคำนวณราคาเสนอขาย</h2>
            
            <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">ประเภทรถ (ล้อ)</label>
                <select
                  value={pricingVehicleType}
                  onChange={e => setPricingVehicleType(e.target.value as any)}
                  className="form-input form-select"
                  style={{ width: '100%', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  <option value="4">รถ 4 ล้อ</option>
                  <option value="6">รถ 6 ล้อ</option>
                  <option value="10">รถ 10 ล้อ</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ระยะทางขนส่ง (กม.)</label>
                <input
                  type="number" min="0" max="3000" inputMode="numeric"
                  value={pricingDistance}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setPricingDistance(isNaN(val) ? '' : val);
                  }}
                  placeholder="กรอกระยะทางกิโลเมตร"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="extra-costs-title" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '8px', marginTop: '16px' }}>🛠️ ค่าบริการพิเศษเพิ่มเติม (ถ้ามี)</div>
            <div className="form-fields-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">ค่าขึ้นชั้น (฿)</label>
                <input
                  type="number" min="0" inputMode="numeric"
                  value={pricingExtraLift}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setPricingExtraLift(isNaN(val) ? '' : val);
                  }}
                  placeholder="0"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">ค่ายกย้าย (฿)</label>
                <input
                  type="number" min="0" inputMode="numeric"
                  value={pricingExtraMove}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setPricingExtraMove(isNaN(val) ? '' : val);
                  }}
                  placeholder="0"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">อื่นๆ / ตีกลับ (฿)</label>
                <input
                  type="number" min="0" inputMode="numeric"
                  value={pricingExtraOther}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setPricingExtraOther(isNaN(val) ? '' : val);
                  }}
                  placeholder="0"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="profit-title" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '8px', marginTop: '16px' }}>▌ กำไรที่คาดหวัง</div>
            <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">รูปแบบกำไร</label>
                <select
                  value={pricingProfitMode}
                  onChange={e => setPricingProfitMode(e.target.value as any)}
                  className="form-input form-select"
                  style={{ width: '100%', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  <option value="%">คิดเป็นเปอร์เซ็นต์ (%)</option>
                  <option value="฿">คิดเป็นจำนวนเงิน (บาท)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">จำนวนกำไรที่ต้องการ</label>
                <input
                  type="number" min="0" inputMode="decimal"
                  value={pricingProfitValue}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setPricingProfitValue(isNaN(val) ? '' : val);
                  }}
                  placeholder="เช่น 15% หรือ 1500"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </section>

          {/* Pricing Results Display */}
          {pricingDistanceNum <= 0 ? (
            <section className="glass-panel empty-state">
              <Calculator size={48} className="empty-icon" />
              <h3>คำนวณราคาจัดส่ง</h3>
              <p>ระบุระยะทางจัดส่งเพื่อดึงค่าต้นทุนและวิเคราะห์ราคาเสนอขายสำหรับทีมขาย</p>
            </section>
          ) : (
            <>
              {/* Target Cost Summary (Active Range Highlight) */}
              {pricingResults.length > 0 && pricingResults[oilRangeIndex] && (
                <section className="glass-panel pricing-highlight-panel animate-slideIn">
                  <div className="highlight-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="highlight-badge">
                      <Droplet size={12} className="text-accent animate-pulse" />
                      <span>ราคาน้ำมันวันนี้: {oilPrice?.toFixed(2)} บ./ลิตร</span>
                    </div>
                    {oilDate && <span className="highlight-date" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{oilDate}</span>}
                  </div>

                  <div className="highlight-body">
                    <p className="highlight-label" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>ราคาแนะนำเสนอขายวันนี้</p>
                    <h2 className="highlight-price" style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--foreground)', textShadow: '0 0 20px var(--primary-glow)', marginBottom: '8px', lineHeight: 1 }}>
                      ฿{pricingResults[oilRangeIndex].recommendedPrice.toLocaleString()}
                    </h2>
                    <p className="highlight-desc" style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                      ปัดเศษระยะทางขนส่งเป็น <strong>{pricingRoundedDist} กม.</strong> | 
                      ต้นทุนรวมวันนี้ <strong>฿{pricingResults[oilRangeIndex].totalCost.toLocaleString()}</strong> 
                      {pricingProfitValue !== '' && ` (บวกกำไร ${pricingProfitValue}${pricingProfitMode})`}
                    </p>
                  </div>
                </section>
              )}

              {/* Table Matrix */}
              <section className="glass-panel pricing-matrix-panel">
                <div className="matrix-header" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 className="section-title">📊 ตารางวิเคราะห์แยกตามราคาน้ำมัน</h3>
                  <span className="matrix-sub" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>ระยะคำนวณ {pricingRoundedDist} กม. (รถ {pricingVehicleType} ล้อ)</span>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <table className="pricing-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--muted-foreground)' }}>ช่วงราคาน้ำมัน (บ.)</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--muted-foreground)' }}>ต้นทุนขนส่ง (บ.)</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--accent)' }}>ราคาแนะนำขาย (บ.)</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--muted-foreground)' }}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingResults.map((res, idx) => (
                        <tr key={idx} className={res.isCurrent ? 'row-active' : ''} style={{ borderBottom: '1px solid var(--border)', background: res.isCurrent ? 'var(--primary-muted)' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }} className="cell-range">{res.range}</td>
                          <td style={{ padding: '12px 16px' }} className="cell-cost">฿{res.totalCost.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }} className="cell-price text-accent">฿{res.recommendedPrice.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px' }} className="cell-status">
                            {res.isCurrent ? (
                              <span className="badge-active" style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600 }}>📍 ราคาวันนี้</span>
                            ) : (
                              <span className="badge-inactive" style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>ปกติ</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pricing-help-footer" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>ราคารวมค่าบริการพิเศษเพิ่มเติม {pricingExtraCosts.toLocaleString()} บ. เรียบร้อยแล้ว (ตัวเลขปัดทศนิยมลงทั้งหมดตามสูตร Excel)</span>
                </div>
              </section>
            </>
          )}
        </main>
      )}

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

      {/* ─── Security Center Drawer Backdrop ─── */}
      <div className={`drawer-backdrop ${isSecurityCenterOpen ? 'open' : ''}`} onClick={() => setIsSecurityCenterOpen(false)} />

      {/* ─── Security Center Drawer ─── */}
      <div className={`settings-drawer ${isSecurityCenterOpen ? 'open' : ''}`} style={{ borderLeft: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <div className="drawer-header" style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.15)' }}>
          <div className="drawer-header-left">
            <Shield size={18} className="text-success animate-pulse" />
            <h3 style={{ color: 'var(--success)' }}>แผงควบคุมสิทธิ์ DLP</h3>
          </div>
          <button onClick={() => setIsSecurityCenterOpen(false)} className="btn-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Status badge */}
          <div className="security-status-card" style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '16px'
          }}>
            <div className="status-indicator-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>
              <Activity className="animate-pulse" size={14} />
              <span>ระบบความปลอดภัย: ทำงานสมบูรณ์ (DLP ACTIVE)</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>ระบบบันทึกความปลอดภัยและตรวจสอบลายนิ้วมือเครื่องบราวเซอร์แบบเรียลไทม์ทำงานอยู่</p>
          </div>

          {/* Active device footprint info */}
          <div className="security-device-info" style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div className="device-info-title" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px', color: 'var(--muted-foreground)' }}>💻 ข้อมูลอุปกรณ์ยืนยันสิทธิ์ในปัจจุบัน</div>
            <div className="device-info-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-foreground)' }}>ชื่อพนักงาน:</span> <strong>{currentUser?.name}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-foreground)' }}>อีเมลผู้ใช้:</span> <strong>{currentUser?.email}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-foreground)' }}>บทบาท:</span> <strong>{currentUser?.role}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-foreground)' }}>หมายเลข IP ของเครื่อง:</span> <strong>{currentUser?.ip}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--muted-foreground)' }}>ลายนิ้วมือบราวเซอร์:</span> <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>{currentUser?.deviceFingerprint}</code></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-foreground)' }}>ระบบปฏิบัติการ:</span> <strong>{currentUser?.deviceOS} ({currentUser?.deviceBrowser})</strong></div>
            </div>
          </div>

          {/* SIMULATE LINK SHARING */}
          <div className="simulate-threat-box" style={{
            background: 'rgba(182, 9, 0, 0.03)',
            border: '1px solid rgba(182, 9, 0, 0.15)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div className="threat-box-header" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} />
              <span>ทดสอบระบบรักษาความปลอดภัย (Simulation)</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.4 }}>
              จำลองเหตุการณ์จริง หากพนักงานทำการ <strong>"คัดลอกลิงก์หรือบอกรหัสผ่าน"</strong> ไปให้เพื่อนหรือบุคคลภายนอกนำไปล็อกอินบนอุปกรณ์เครื่องอื่น (ซึ่งจะมี IP และลายนิ้วมือเครื่องแปลกปลอม)
            </p>
            <button
              onClick={triggerFingerprintHijackSimulation}
              className="btn-simulate-threat"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px var(--primary-glow)'
              }}
            >
              <Fingerprint size={14} />
              <span>จำลองคนนอกแอบใช้ลิงก์/สวมสิทธิ์บัญชี</span>
            </button>
          </div>

          {/* SECURITY AUDIT LOGS */}
          <div className="security-audit-logs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="logs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <div className="logs-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={12} />
                <span>บันทึกประวัติความปลอดภัย (DLP logs)</span>
              </div>
              {securityLogs.length > 0 && (
                <button 
                  onClick={handleClearLogs} 
                  className="btn-clear-logs"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted-foreground)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  ล้างบันทึก
                </button>
              )}
            </div>

            <div className="logs-list" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {securityLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`log-item-card ${log.status}`}
                  style={{
                    background: log.status === 'blocked' ? 'rgba(239, 68, 68, 0.05)' : log.status === 'warn' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                    border: log.status === 'blocked' ? '1px solid rgba(239, 68, 68, 0.2)' : log.status === 'warn' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 10px',
                    fontSize: '0.72rem'
                  }}
                >
                  <div className="log-item-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', opacity: 0.7 }}>
                    <span 
                      className={`log-badge ${log.status}`}
                      style={{
                        fontWeight: 800,
                        color: log.status === 'blocked' ? 'var(--error)' : log.status === 'warn' ? 'var(--warning)' : 'var(--success)',
                        textTransform: 'uppercase',
                        fontSize: '0.62rem'
                      }}
                    >
                      {log.status === 'blocked' ? '🔴 BLOCKED' : log.status === 'warn' ? '🟡 WARNING' : '🟢 SECURE'}
                    </span>
                    <span className="log-time" style={{ fontSize: '0.65rem' }}>{log.time.split(' ')[1] || log.time}</span>
                  </div>
                  <p className="log-message" style={{ fontWeight: 500, color: 'var(--foreground)', marginBottom: '4px', lineHeight: 1.3 }}>{log.event}</p>
                  <div className="log-meta-footer" style={{ display: 'flex', gap: '8px', opacity: 0.6, fontSize: '0.65rem' }}>
                    <span>IP: {log.ip}</span>
                    <span>•</span>
                    <span>อุปกรณ์: {log.device}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
