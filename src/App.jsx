import React, { useEffect, useMemo, useState } from 'react';
import { supabase, hasSupabaseConfig } from './lib/supabaseClient.js';

const PAGES = [
  ['dashboard', '總覽', '/icons/dashboard.png'],
  ['entry', '單筆 / 批次送件', '/icons/entry.png'],
  ['payment', '選案繳費', '/icons/payment.png'],
  ['accounting', '會計對帳', '/icons/accounting.png'],
  ['accountingSearch', '會計查詢', '/icons/accountingSearch.svg'],
  ['faxPickup', '傳真與領件', '/icons/faxPickup.png'],
  ['caseSearch', '案件查詢', '/icons/caseSearch.png'],
  ['statistics', '統計數據', '/icons/statistics.png'],
  ['exportData', '匯出資料', '/icons/exportData.svg'],
  ['agencies', '仲介與扣款帳號', '/icons/agencies.png'],
  ['immigrationContacts', '移民署服務站', '/icons/immigrationContacts.svg'],
  ['brigadeContacts', '專勤隊聯絡資訊', '/icons/brigadeContacts.svg'],
  ['audit', '操作紀錄', '/icons/audit.svg'],
  ['settings', '系統設定', '/icons/settings.png']
];

const LINKS = [
  ['外籍移工線上申辦系統', 'https://coa.immigration.gov.tw/coa-frontend/foreign-labor'],
  ['外國專業人才及親屬線上申辦系統', 'https://coa.immigration.gov.tw/coa-frontend/foreign-white-collar'],
  ['晶片居留證資料查詢', 'https://niaicinfo.immigration.gov.tw/icinfo-frontend/zh#MyAnchor'],
  ['移民署中文網站', 'https://www.immigration.gov.tw/7163']
];

const TABLES = [
  'agencies', 'agency_accounts', 'handlers', 'application_items', 'system_settings', 'device_locks',
  'arc_cases', 'payment_batches', 'payment_details', 'account_transactions', 'fax_batches', 'fax_details', 'contacts', 'audit_logs'
];

const EMPTY_SINGLE = {
  handler_id: '', agency_id: '', employer_name: '', worker_name: '', entry_date: '', application_date: today(),
  group_no: '', application_item_id: '', amount: 1000, note: ''
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  const d = dateText ? new Date(dateText) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(n) {
  return Number(n || 0).toLocaleString('zh-TW');
}

function num(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v : 0;
}

function makeNo(prefix) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${y}${m}${day}-${rand}`;
}

function sortText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-Hant');
}

function csvDownload(filename, rows) {
  const csv = rows.map(row => row.map(cell => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printBlock(blockId, title = '列印') {
  const node = document.getElementById(blockId);
  if (!node) return;
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body class="print-body"><div class="print-only-block">${node.outerHTML}</div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function getDeviceId() {
  let id = localStorage.getItem('arc_device_id');
  if (!id) {
    id = 'ARC-' + (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    localStorage.setItem('arc_device_id', id);
  }
  return id;
}

function useSettings(settings) {
  return useMemo(() => Object.fromEntries((settings || []).map(s => [s.key, s.value])), [settings]);
}

function StatusTag({ children, tone = 'gray' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function ModalLock({ handlers, onLock }) {
  const [handlerId, setHandlerId] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const activeHandlers = handlers.filter(h => h.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-mark">ARC</div>
        <h1>設定本機使用者</h1>
        <p>第一次開啟系統請選擇這台電腦固定使用者。選定後會鎖定，下次自動沿用；若要更換需由管理員於系統設定解除。</p>
        <label>本機代號</label>
        <input value={deviceLabel} onChange={e => setDeviceLabel(e.target.value)} placeholder="例：行政櫃台-01 / 會計電腦-01" />
        <label>固定使用者</label>
        <select value={handlerId} onChange={e => setHandlerId(e.target.value)}>
          <option value="">請選擇</option>
          {activeHandlers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button className="primary wide" disabled={!handlerId} onClick={() => onLock(handlerId, deviceLabel)}>鎖定本機使用者</button>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(Object.fromEntries(TABLES.map(t => [t, []])));
  const [deviceId] = useState(getDeviceId);
  const [deviceLock, setDeviceLock] = useState(null);
  const [toast, setToast] = useState('');
  const settings = useSettings(data.system_settings);

  const activeHandlers = useMemo(() => data.handlers.filter(x => x.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [data.handlers]);
  const activeAgencies = useMemo(() => data.agencies.filter(x => x.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [data.agencies]);
  const activeItems = useMemo(() => data.application_items.filter(x => x.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [data.application_items]);
  const activeAccounts = useMemo(() => data.agency_accounts.filter(x => x.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [data.agency_accounts]);

  async function loadAll() {
    if (!hasSupabaseConfig) {
      setLoading(false);
      setError('尚未設定 Supabase 環境變數，請先設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const results = await Promise.all(TABLES.map(async table => {
        const { data: rows, error: err } = await supabase.from(table).select('*');
        if (err) throw new Error(`${table}: ${err.message}`);
        return [table, rows || []];
      }));
      const next = Object.fromEntries(results);
      setData(next);
      const lock = next.device_locks.find(l => l.device_id === deviceId && l.is_locked);
      setDeviceLock(lock || null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function log(action_type, table_name, record_id, before_data = {}, after_data = {}, reason = '') {
    if (!supabase) return;
    await supabase.from('audit_logs').insert({
      actor_handler_id: deviceLock?.handler_id || null,
      actor_name: deviceLock?.handler_name || '未鎖定',
      device_id: deviceId,
      action_type,
      table_name,
      record_id: String(record_id || ''),
      before_data,
      after_data,
      reason
    });
  }

  async function lockDevice(handlerId, deviceLabel) {
    const handler = activeHandlers.find(h => h.id === handlerId);
    if (!handler) return;
    const row = {
      device_id: deviceId,
      device_label: deviceLabel || '未命名電腦',
      handler_id: handler.id,
      handler_name: handler.name,
      is_locked: true,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      unlocked_at: null,
      unlock_reason: ''
    };
    const { error: err } = await supabase.from('device_locks').upsert(row, { onConflict: 'device_id' });
    if (err) return alert(err.message);
    setDeviceLock(row);
    await log('lock_device', 'device_locks', deviceId, {}, row, '第一次鎖定本機使用者');
    await loadAll();
  }

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function insertRow(table, row, action = 'create') {
    const { data: inserted, error: err } = await supabase.from(table).insert(row).select('*').single();
    if (err) throw err;
    await log(action, table, inserted.id, {}, inserted);
    await loadAll();
    return inserted;
  }

  async function updateRow(table, id, patch, action = 'update', reason = '') {
    const before = data[table]?.find(x => x.id === id) || {};
    const { data: updated, error: err } = await supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (err) throw err;
    await log(action, table, id, before, updated, reason);
    await loadAll();
    return updated;
  }

  if (loading) return <div className="loading">系統資料載入中...</div>;
  if (error) return <SetupError message={error} />;
  if (!deviceLock) return <ModalLock handlers={data.handlers} onLock={lockDevice} />;

  const common = { data, settings, deviceLock, activeHandlers, activeAgencies, activeItems, activeAccounts, loadAll, log, insertRow, updateRow, flash, setPage };
  const current = PAGES.find(p => p[0] === page);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><div className="logo-box">ARC</div><div><strong>居留證控管</strong><span>Supabase 正式版 V1</span></div></div>
        <nav>{PAGES.map(([key, label, icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><img className="nav-img" src={icon} alt="" />{label}</button>)}</nav>
        <div className="side-card"><b>目前使用者</b><br />{deviceLock.handler_name}<br /><small>{deviceLock.device_label || deviceId}</small></div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div><h1>{current?.[1] || '總覽'}</h1><p>資料庫：Supabase｜部署：Vercel｜版本：ARC Supabase V1</p></div>
          <div className="user-chip">🔒 {deviceLock.handler_name} 已鎖定</div>
        </div>
        {toast && <div className="toast">{toast}</div>}
        {page === 'dashboard' && <Dashboard {...common} />}
        {page === 'entry' && <EntryPage {...common} />}
        {page === 'payment' && <PaymentPage {...common} />}
        {page === 'accounting' && <AccountingPage {...common} />}
        {page === 'accountingSearch' && <AccountingSearchPage {...common} />}
        {page === 'faxPickup' && <FaxPickupPage {...common} />}
        {page === 'caseSearch' && <CaseSearchPage {...common} />}
        {page === 'statistics' && <StatisticsPage {...common} />}
        {page === 'exportData' && <ExportDataPage {...common} />}
        {page === 'agencies' && <AgencyAccountsPage {...common} />}
        {page === 'immigrationContacts' && <ContactsPage {...common} type="service_station" title="全省移民署服務站" />}
        {page === 'brigadeContacts' && <ContactsPage {...common} type="brigade" title="全省專勤隊聯絡資訊" />}
        {page === 'audit' && <AuditPage {...common} />}
        {page === 'settings' && <SettingsPage {...common} setDeviceLock={setDeviceLock} deviceId={deviceId} />}
      </main>
    </div>
  );
}

function SetupError({ message }) {
  return <div className="setup-error"><h1>系統尚未完成設定</h1><p>{message}</p><ol><li>到 Supabase SQL Editor 依序執行 <code>supabase/001_schema.sql</code>、<code>supabase/002_seed_data.sql</code></li><li>在 Vercel 環境變數設定 <code>VITE_SUPABASE_URL</code> 與 <code>VITE_SUPABASE_ANON_KEY</code></li><li>重新部署 Vercel</li></ol></div>;
}

function Dashboard({ data, settings, activeAgencies, activeAccounts, setPage }) {
  const cases = data.arc_cases.filter(c => !c.is_voided);
  const pendingPay = cases.filter(c => c.payment_status === 'pending').length;
  const pendingPickup = cases.filter(c => c.pickup_status === 'pending').length;
  const pendingAcct = data.payment_batches.filter(b => b.financial_status === 'pending').length;
  const month = today().slice(0, 7);
  const monthPaid = data.payment_batches.filter(b => String(b.payment_date || '').startsWith(month)).reduce((s, b) => s + num(b.grand_total), 0);
  return <>
    <div className="kpis">
      <div className="kpi"><span>待繳款</span><b>{pendingPay}</b></div>
      <div className="kpi"><span>待領件</span><b>{pendingPickup}</b></div>
      <div className="kpi"><span>待會計確認</span><b>{pendingAcct}</b></div>
      <div className="kpi"><span>當月繳款</span><b>{money(monthPaid)}</b></div>
      <div className="kpi"><span>案件總數</span><b>{cases.length}</b></div>
    </div>
    <section className="card">
      <h2>常用官方連結</h2>
      <div className="link-grid">
        {LINKS.map(([label, url]) => <a className="link-card" key={url} href={url} target="_blank" rel="noreferrer"><span>↗</span>{label}</a>)}
      </div>
    </section>
    <section className="grid two">
      <div className="card">
        <h2>提醒事項</h2>
        <ul className="reminders">
          <li><b>週一</b> 繳費</li>
          <li><b>週二</b> 傳真</li>
          <li><b>週四</b> 領件</li>
          <li><b>乾坤、灃禾</b> 繳費前請先與財務確認</li>
        </ul>
      </div>
      <div className="card">
        <h2>仲介帳戶餘額</h2>
        <table><thead><tr><th>仲介</th><th>帳號</th><th className="right">餘額</th></tr></thead><tbody>{activeAccounts.map(a => {
          const agency = activeAgencies.find(x => x.id === a.agency_id);
          return <tr key={a.id}><td>{agency?.short_name}</td><td>{a.bank_name} {a.bank_code}｜{a.account_number}</td><td className="right">{money(a.balance)}</td></tr>;
        })}</tbody></table>
      </div>
    </section>
    <section className="card">
      <h2>快速操作</h2>
      <div className="toolbar"><button onClick={() => setPage('entry')}>新增送件</button><button onClick={() => setPage('payment')}>選案繳費</button><button onClick={() => setPage('faxPickup')}>傳真與領件</button><button onClick={() => setPage('accountingSearch')}>會計查詢</button></div>
    </section>
  </>;
}

function EntryPage(props) {
  const { activeHandlers, activeAgencies, activeItems, deviceLock, insertRow, log, flash, loadAll, data } = props;
  const [mode, setMode] = useState('single');
  const [form, setForm] = useState({ ...EMPTY_SINGLE, handler_id: deviceLock.handler_id, agency_id: activeAgencies[0]?.id || '', application_item_id: activeItems[0]?.id || '' });
  const [batchRows, setBatchRows] = useState(Array.from({ length: 5 }, () => ({ ...EMPTY_SINGLE, handler_id: deviceLock.handler_id, agency_id: activeAgencies[0]?.id || '', application_item_id: activeItems[0]?.id || '' })));

  useEffect(() => {
    const item = activeItems.find(i => i.id === form.application_item_id);
    if (item && !form.amount) setForm(f => ({ ...f, amount: item.default_amount }));
  }, [form.application_item_id]);

  function rowPayload(row, entryType = 'online') {
    const handler = activeHandlers.find(h => h.id === row.handler_id);
    const agency = activeAgencies.find(a => a.id === row.agency_id);
    const item = activeItems.find(i => i.id === row.application_item_id);
    return {
      case_no: makeNo(entryType === 'onsite' ? 'ONS' : 'ARC'),
      handler_id: handler?.id || null,
      handler_name: handler?.name || '',
      agency_id: agency?.id || null,
      agency_code: agency?.code || '',
      agency_short_name: agency?.short_name || '',
      employer_name: row.employer_name || '',
      worker_name: row.worker_name || '',
      entry_date: row.entry_date || null,
      application_date: row.application_date || today(),
      group_no: row.group_no || '',
      application_item_id: item?.id || null,
      application_item_name: item?.name || '',
      amount: num(row.amount || item?.default_amount),
      entry_type: entryType,
      payment_status: entryType === 'onsite' ? 'no_payment' : 'pending',
      pickup_status: entryType === 'onsite' ? 'pending' : 'none',
      card_count: 1,
      note: row.note || '',
      created_by: deviceLock.handler_name,
      updated_by: deviceLock.handler_name
    };
  }

  async function saveSingle(entryType = 'online') {
    if (!form.employer_name || !form.worker_name) return alert('請輸入雇主與工人名稱');
    try {
      await insertRow('arc_cases', rowPayload(form, entryType), entryType === 'onsite' ? 'create_onsite_case' : 'create_case');
      flash(entryType === 'onsite' ? '已新增現場送件，案件已進待領件' : '已新增送件案件');
      setForm({ ...EMPTY_SINGLE, handler_id: deviceLock.handler_id, agency_id: activeAgencies[0]?.id || '', application_item_id: activeItems[0]?.id || '' });
    } catch (err) { alert(err.message); }
  }

  function fillBlankRows() {
    const base = batchRows.find(r => r.employer_name || r.worker_name || r.entry_date || r.application_date || r.handler_id || r.agency_id || r.application_item_id) || batchRows[0];
    setBatchRows(rows => rows.map(r => {
      if (r.employer_name || r.worker_name || r.group_no) return r;
      return { ...r, handler_id: base.handler_id, agency_id: base.agency_id, employer_name: base.employer_name, entry_date: base.entry_date, application_date: base.application_date, application_item_id: base.application_item_id, amount: base.amount };
    }));
  }

  function applyEmployerToBlank() {
    const employer = batchRows.find(r => r.employer_name)?.employer_name || '';
    if (!employer) return;
    setBatchRows(rows => rows.map(r => r.employer_name ? r : { ...r, employer_name: employer }));
  }

  async function saveBatch() {
    const rows = batchRows.filter(r => r.employer_name && r.worker_name);
    if (!rows.length) return alert('沒有可儲存的批次資料');
    try {
      const payloads = rows.map(r => rowPayload(r, 'online'));
      const { data: inserted, error } = await supabase.from('arc_cases').insert(payloads).select('*');
      if (error) throw error;
      await log('create_batch_cases', 'arc_cases', inserted.map(x => x.id).join(','), {}, { count: inserted.length, rows: inserted });
      await loadAll();
      flash(`已批次新增 ${inserted.length} 筆送件`);
      setBatchRows(Array.from({ length: 5 }, () => ({ ...EMPTY_SINGLE, handler_id: deviceLock.handler_id, agency_id: activeAgencies[0]?.id || '', application_item_id: activeItems[0]?.id || '' })));
    } catch (err) { alert(err.message); }
  }

  const fieldSet = (value, setter) => ({ activeHandlers, activeAgencies, activeItems, value, setter });
  return <>
    <section className="card">
      <h2>送件登記</h2>
      <div className="tabs"><button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>單筆送件</button><button className={mode === 'batch' ? 'active' : ''} onClick={() => setMode('batch')}>批次送件</button><button className={mode === 'onsite' ? 'active' : ''} onClick={() => setMode('onsite')}>單筆現場送件</button></div>
      {mode !== 'batch' && <div className="form-grid">
        <CaseFields {...fieldSet(form, setForm)} />
        <div className="span-full toolbar"><button className="primary" onClick={() => saveSingle(mode === 'onsite' ? 'onsite' : 'online')}>{mode === 'onsite' ? '新增現場送件並移至待領件' : '新增送件'}</button></div>
      </div>}
      {mode === 'batch' && <>
        <div className="toolbar"><button onClick={fillBlankRows}>一鍵帶入空白列</button><button onClick={applyEmployerToBlank}>雇主名稱套用到空白列</button><button onClick={() => setBatchRows(r => [...r, { ...EMPTY_SINGLE, handler_id: deviceLock.handler_id, agency_id: activeAgencies[0]?.id || '', application_item_id: activeItems[0]?.id || '' }])}>新增列</button><button onClick={() => setBatchRows(rows => rows.filter(r => r.employer_name || r.worker_name || r.group_no))}>刪除空白列</button><button className="primary" onClick={saveBatch}>儲存批次送件</button></div>
        <div className="table-wrap"><table className="compact"><thead><tr><th>承辦</th><th>仲介</th><th>雇主</th><th>工人</th><th>入境日</th><th>申請日</th><th>團號</th><th>項目</th><th>金額</th><th></th></tr></thead><tbody>{batchRows.map((r, idx) => <tr key={idx}>
          <td><select value={r.handler_id} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, handler_id: e.target.value } : x))}>{activeHandlers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></td>
          <td><select value={r.agency_id} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, agency_id: e.target.value } : x))}>{activeAgencies.map(a => <option key={a.id} value={a.id}>{a.short_name}</option>)}</select></td>
          <td><input value={r.employer_name} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, employer_name: e.target.value } : x))} /></td>
          <td><input value={r.worker_name} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, worker_name: e.target.value } : x))} /></td>
          <td><input type="date" value={r.entry_date || ''} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, entry_date: e.target.value } : x))} /></td>
          <td><input type="date" value={r.application_date || ''} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, application_date: e.target.value } : x))} /></td>
          <td><input value={r.group_no} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, group_no: e.target.value } : x))} /></td>
          <td><select value={r.application_item_id} onChange={e => { const item = activeItems.find(x => x.id === e.target.value); setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, application_item_id: e.target.value, amount: item?.default_amount || x.amount } : x)); }}>{activeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></td>
          <td><input type="number" value={r.amount} onChange={e => setBatchRows(rows => rows.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} /></td>
          <td><button className="danger mini" onClick={() => setBatchRows(rows => rows.filter((_, i) => i !== idx))}>刪除</button></td>
        </tr>)}</tbody></table></div>
      </>}
    </section>
    <section className="card"><h2>最近送件</h2><CaseMiniTable cases={data.arc_cases.filter(c => !c.is_voided).slice(-8).reverse()} /></section>
  </>;
}

function CaseFields({ activeHandlers, activeAgencies, activeItems, value, setter }) {
  function set(key, val) { setter(v => ({ ...v, [key]: val })); }
  return <>
    <label>承辦<select value={value.handler_id} onChange={e => set('handler_id', e.target.value)}>{activeHandlers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
    <label>仲介別<select value={value.agency_id} onChange={e => set('agency_id', e.target.value)}>{activeAgencies.map(a => <option key={a.id} value={a.id}>{a.short_name}</option>)}</select></label>
    <label>雇主名<input value={value.employer_name} onChange={e => set('employer_name', e.target.value)} /></label>
    <label>工人名<input value={value.worker_name} onChange={e => set('worker_name', e.target.value)} /></label>
    <label>入境日<input type="date" value={value.entry_date || ''} onChange={e => set('entry_date', e.target.value)} /></label>
    <label>申請日<input type="date" value={value.application_date || ''} onChange={e => set('application_date', e.target.value)} /></label>
    <label>申請團號<input value={value.group_no} onChange={e => set('group_no', e.target.value)} /></label>
    <label>申請項目<select value={value.application_item_id} onChange={e => { const item = activeItems.find(i => i.id === e.target.value); setter(v => ({ ...v, application_item_id: e.target.value, amount: item?.default_amount || v.amount })); }}>{activeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label>金額<input type="number" value={value.amount} onChange={e => set('amount', e.target.value)} /></label>
    <label className="span-full">備註<input value={value.note} onChange={e => set('note', e.target.value)} /></label>
  </>;
}

function PaymentPage({ data, settings, activeAccounts, activeAgencies, deviceLock, loadAll, log, flash }) {
  const [selected, setSelected] = useState([]);
  const [receiptMap, setReceiptMap] = useState({});
  const [amountMap, setAmountMap] = useState({});
  const [paymentDate, setPaymentDate] = useState(today());
  const [payer, setPayer] = useState('');
  const [fee, setFee] = useState(settings.default_fee || '7');
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id || '');
  const [query, setQuery] = useState('');
  const pending = data.arc_cases.filter(c => !c.is_voided && c.entry_type !== 'onsite' && c.payment_status === 'pending');
  const filtered = pending.filter(c => !query || `${c.case_no}${c.employer_name}${c.worker_name}${c.handler_name}${c.agency_short_name}`.includes(query));
  const selectedCases = pending.filter(c => selected.includes(c.id));
  const totalAmount = selectedCases.reduce((s, c) => s + num(amountMap[c.id] ?? c.amount), 0);
  const agencyWarn = selectedCases.some(c => ['乾坤', '灃禾'].includes(c.agency_short_name));
  const account = activeAccounts.find(a => a.id === accountId);
  const agency = activeAgencies.find(a => a.id === account?.agency_id);

  async function savePayment() {
    if (!selectedCases.length) return alert('請先勾選案件');
    if (!accountId) return alert('請選擇扣款帳號');
    try {
      const batch = {
        batch_no: makeNo('PAY'), payment_date: paymentDate, payer, account_id: accountId,
        agency_id: agency?.id || null, agency_short_name: agency?.short_name || '',
        account_label: `${account?.bank_name || ''} ${account?.bank_code || ''}｜${account?.account_number || ''}`,
        fee: num(fee), total_case_amount: totalAmount, grand_total: totalAmount + num(fee),
        financial_status: 'pending', created_by: deviceLock.handler_name, updated_by: deviceLock.handler_name
      };
      const { data: insertedBatch, error: bErr } = await supabase.from('payment_batches').insert(batch).select('*').single();
      if (bErr) throw bErr;
      const details = selectedCases.map(c => ({
        batch_id: insertedBatch.id, case_id: c.id, receipt_no: receiptMap[c.id] || '', payment_amount: num(amountMap[c.id] ?? c.amount),
        entry_date: c.entry_date || null, employer_name: c.employer_name, worker_name: c.worker_name, handler_name: c.handler_name,
        agency_short_name: c.agency_short_name, application_item_name: c.application_item_name
      }));
      const { error: dErr } = await supabase.from('payment_details').insert(details);
      if (dErr) throw dErr;
      for (const c of selectedCases) {
        const item = data.application_items.find(i => i.name === c.application_item_name);
        const download = item?.download_after_payment || ['初辦居留證', '初辦居留證(紙本)', '報備不製證'].includes(c.application_item_name);
        const { error: cErr } = await supabase.from('arc_cases').update({
          payment_status: 'paid', pickup_status: download ? 'download' : 'pending', receipt_no: receiptMap[c.id] || '', payment_date: paymentDate,
          updated_by: deviceLock.handler_name, updated_at: new Date().toISOString()
        }).eq('id', c.id);
        if (cErr) throw cErr;
      }
      await log('create_payment_batch', 'payment_batches', insertedBatch.id, {}, { batch: insertedBatch, details });
      await loadAll();
      flash('已建立繳費批次，等待會計確認');
      setSelected([]); setReceiptMap({}); setAmountMap({});
    } catch (err) { alert(err.message); }
  }

  return <section className="card">
    <h2>選案繳費</h2>
    {agencyWarn && <div className="alert">乾坤、灃禾繳費前請先與財務確認。</div>}
    <div className="toolbar"><input placeholder="搜尋案件、雇主、工人、承辦" value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => setSelected(filtered.map(c => c.id))}>一鍵全選</button><button onClick={() => setSelected([])}>取消勾選</button></div>
    <div className="table-wrap"><table><thead><tr><th></th><th>案件編號</th><th>仲介</th><th>承辦</th><th>雇主</th><th>工人</th><th>入境日</th><th>項目</th><th>收件號</th><th className="right">金額</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}>
      <td><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(s => e.target.checked ? [...s, c.id] : s.filter(id => id !== c.id))} /></td>
      <td>{c.case_no}</td><td>{c.agency_short_name}</td><td>{c.handler_name}</td><td>{c.employer_name}</td><td>{c.worker_name}</td><td>{c.entry_date}</td><td>{c.application_item_name}</td>
      <td><input value={receiptMap[c.id] || ''} onChange={e => setReceiptMap(m => ({ ...m, [c.id]: e.target.value }))} placeholder="可後補" /></td>
      <td className="right"><input type="number" value={amountMap[c.id] ?? c.amount} onChange={e => setAmountMap(m => ({ ...m, [c.id]: e.target.value }))} /></td>
    </tr>)}</tbody></table></div>
    <div className="payment-box">
      <label>繳費日期<input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
      <label>繳款人<input value={payer} onChange={e => setPayer(e.target.value)} /></label>
      <label>手續費<input type="number" value={fee} onChange={e => setFee(e.target.value)} /></label>
      <label>扣款帳號<select value={accountId} onChange={e => setAccountId(e.target.value)}>{activeAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label || `${a.bank_name} ${a.account_number}`}</option>)}</select></label>
      <div className="summary-total">明細 {selectedCases.length} 筆｜金額 {money(totalAmount)}｜手續費 {money(fee)}｜合計 {money(totalAmount + num(fee))}</div>
      <button className="primary" onClick={savePayment}>建立繳費批次</button>
    </div>
  </section>;
}

function AccountingPage({ data, activeAccounts, deviceLock, loadAll, log, flash }) {
  const pending = data.payment_batches.filter(b => b.financial_status === 'pending').sort((a,b) => sortText(a.payment_date,b.payment_date));
  async function confirmBatch(batch) {
    const account = activeAccounts.find(a => a.id === batch.account_id);
    if (!account) return alert('找不到扣款帳號');
    if (!confirm(`確認此批次扣款 ${money(batch.grand_total)} 元？`)) return;
    const beforeBalance = num(account.balance);
    const afterBalance = beforeBalance - num(batch.grand_total);
    try {
      const { error: aErr } = await supabase.from('agency_accounts').update({ balance: afterBalance, updated_at: new Date().toISOString() }).eq('id', account.id);
      if (aErr) throw aErr;
      const { error: bErr } = await supabase.from('payment_batches').update({ financial_status: 'confirmed', confirmed_by: deviceLock.handler_name, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', batch.id);
      if (bErr) throw bErr;
      const { error: tErr } = await supabase.from('account_transactions').insert({ account_id: account.id, agency_id: account.agency_id, batch_id: batch.id, transaction_type: 'payment_confirm', amount: -num(batch.grand_total), balance_before: beforeBalance, balance_after: afterBalance, created_by: deviceLock.handler_name, note: `會計確認 ${batch.batch_no}` });
      if (tErr) throw tErr;
      await log('confirm_payment_batch', 'payment_batches', batch.id, batch, { ...batch, financial_status: 'confirmed', balance_before: beforeBalance, balance_after: afterBalance });
      await loadAll(); flash('會計確認完成，餘額已扣除');
    } catch (err) { alert(err.message); }
  }
  return <section className="card"><h2>會計對帳</h2>
    <BatchList batches={pending} details={data.payment_details} onConfirm={confirmBatch} showConfirm />
  </section>;
}

function BatchList({ batches, details, onConfirm, showConfirm }) {
  return <div className="batch-list">{batches.map(b => {
    const ds = details.filter(d => d.batch_id === b.id);
    return <details className="batch-card" key={b.id} open>
      <summary><b>{b.batch_no}</b><span>{b.payment_date}</span><span>{b.account_label}</span><span>{b.financial_status === 'confirmed' ? '已確認' : '待確認'}</span><span>合計 {money(b.grand_total)}</span>{showConfirm && <button className="primary mini" onClick={(e) => { e.preventDefault(); onConfirm(b); }}>財務確認</button>}</summary>
      <table><thead><tr><th>收件號</th><th>仲介</th><th>承辦</th><th>雇主</th><th>工人</th><th>入境日</th><th>項目</th><th className="right">金額</th></tr></thead><tbody>{ds.map(d => <tr key={d.id}><td>{d.receipt_no}</td><td>{d.agency_short_name}</td><td>{d.handler_name}</td><td>{d.employer_name}</td><td>{d.worker_name}</td><td>{d.entry_date}</td><td>{d.application_item_name}</td><td className="right">{money(d.payment_amount)}</td></tr>)}</tbody></table>
    </details>;
  })}{!batches.length && <div className="empty">目前沒有待確認批次。</div>}</div>;
}

function AccountingSearchPage({ data }) {
  const [from, setFrom] = useState(today().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState('all');
  const [mode, setMode] = useState('batch');
  const batches = data.payment_batches.filter(b => (!from || b.payment_date >= from) && (!to || b.payment_date <= to) && (status === 'all' || b.financial_status === status)).sort((a,b) => sortText(a.payment_date,b.payment_date));
  const rows = mode === 'batch' ? batches : data.payment_details.filter(d => batches.some(b => b.id === d.batch_id));
  function exportRows() {
    if (mode === 'batch') csvDownload(`會計批次_${from}_${to}.csv`, [['批次','繳費日','帳號','總金額','手續費','合計','狀態','確認人'], ...batches.map(b => [b.batch_no,b.payment_date,b.account_label,b.total_case_amount,b.fee,b.grand_total,b.financial_status,b.confirmed_by])]);
    else csvDownload(`會計明細_${from}_${to}.csv`, [['批次','收件號','仲介','承辦','雇主','工人','入境日','項目','金額'], ...rows.map(d => [data.payment_batches.find(b => b.id === d.batch_id)?.batch_no || '', d.receipt_no,d.agency_short_name,d.handler_name,d.employer_name,d.worker_name,d.entry_date,d.application_item_name,d.payment_amount])]);
  }
  return <section className="card"><h2>會計查詢</h2>
    <div className="toolbar"><label>起<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>迄<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部狀態</option><option value="pending">待確認</option><option value="confirmed">已確認</option></select><select value={mode} onChange={e => setMode(e.target.value)}><option value="batch">批次</option><option value="detail">個別明細</option></select><button onClick={exportRows}>匯出查詢結果</button></div>
    {mode === 'batch' ? <BatchList batches={batches} details={data.payment_details} /> : <table><thead><tr><th>批次</th><th>收件號</th><th>仲介</th><th>承辦</th><th>雇主</th><th>工人</th><th>入境日</th><th>項目</th><th className="right">金額</th></tr></thead><tbody>{rows.map(d => <tr key={d.id}><td>{data.payment_batches.find(b => b.id === d.batch_id)?.batch_no}</td><td>{d.receipt_no}</td><td>{d.agency_short_name}</td><td>{d.handler_name}</td><td>{d.employer_name}</td><td>{d.worker_name}</td><td>{d.entry_date}</td><td>{d.application_item_name}</td><td className="right">{money(d.payment_amount)}</td></tr>)}</tbody></table>}
  </section>;
}

function FaxPickupPage({ data, settings, deviceLock, loadAll, log, flash }) {
  const eligible = data.arc_cases.filter(c => !c.is_voided && ['pending', 'hold', 'abnormal'].includes(c.pickup_status) && (c.payment_status === 'paid' || c.payment_status === 'no_payment'));
  const [selected, setSelected] = useState([]);
  const [edits, setEdits] = useState({});
  const [query, setQuery] = useState('');
  const faxDate = today();
  const pickupDate = addDays(faxDate, 2);
  const filtered = eligible.filter(c => !query || `${c.case_no}${c.receipt_no}${c.employer_name}${c.worker_name}${c.handler_name}`.includes(query));
  const merged = c => ({ ...c, ...(edits[c.id] || {}) });
  const selectedCases = eligible.filter(c => selected.includes(c.id)).map(merged);
  const faxRows = [...selectedCases].sort((a,b) => sortText(a.payment_date || a.application_date, b.payment_date || b.application_date) || sortText(a.receipt_no, b.receipt_no) || sortText(a.foreign_code_last5, b.foreign_code_last5));
  const receiptRows = [...selectedCases].sort((a,b) => sortText(a.handler_name, b.handler_name) || sortText(a.employer_name, b.employer_name));
  const totalCards = selectedCases.reduce((s,c) => s + num(c.card_count || 1), 0);

  function patch(id, key, val) { setEdits(e => ({ ...e, [id]: { ...(e[id] || {}), [key]: val } })); }
  async function saveEdits() {
    try {
      for (const id of selected) {
        const p = edits[id];
        if (p) {
          const before = data.arc_cases.find(c => c.id === id);
          const { error } = await supabase.from('arc_cases').update({ ...p, updated_by: deviceLock.handler_name, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          await log('update_fax_pickup_fields', 'arc_cases', id, before, { ...before, ...p });
        }
      }
      await loadAll(); flash('已儲存補 KEY 與領件欄位');
    } catch (err) { alert(err.message); }
  }
  async function markPicked() {
    if (!selected.length) return alert('請先勾選案件');
    try {
      await saveEdits();
      for (const c of selectedCases) {
        const { error } = await supabase.from('arc_cases').update({ pickup_status: 'picked', pickup_date: c.pickup_date || pickupDate, pickup_person: deviceLock.handler_name, updated_by: deviceLock.handler_name, updated_at: new Date().toISOString() }).eq('id', c.id);
        if (error) throw error;
      }
      await log('mark_picked_batch', 'arc_cases', selected.join(','), {}, { selected, pickup_date: pickupDate });
      await loadAll(); flash('已批次更新為已領件'); setSelected([]);
    } catch (err) { alert(err.message); }
  }
  async function saveFaxBatch() {
    if (!selected.length) return alert('請先勾選案件');
    await saveEdits();
    const payload = { faxRows, receiptRows, settings, totalCards };
    const faxNo = makeNo('FAX');
    const { data: batch, error } = await supabase.from('fax_batches').insert({ fax_no: faxNo, fax_date: faxDate, pickup_date: pickupDate, total_cards: totalCards, created_by: deviceLock.handler_name, print_payload: payload }).select('*').single();
    if (error) return alert(error.message);
    const details = faxRows.map(c => ({ fax_batch_id: batch.id, case_id: c.id, receipt_no: c.receipt_no, card_count: num(c.card_count || 1), handler_code: c.handler_code || '', foreign_code_last5: c.foreign_code_last5 || '', old_card: !!c.old_card, employer_name: c.employer_name, worker_name: c.worker_name, handler_name: c.handler_name }));
    const { error: dErr } = await supabase.from('fax_details').insert(details);
    if (dErr) return alert(dErr.message);
    await log('create_fax_batch', 'fax_batches', batch.id, {}, { batch, details });
    await loadAll(); flash('已建立傳真批次紀錄');
  }

  return <>
    <section className="card no-print"><h2>傳真與領件</h2>
      <div className="toolbar"><input placeholder="搜尋收件號、雇主、工人、承辦" value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => setSelected(filtered.map(c => c.id))}>一鍵全選</button><button onClick={() => setSelected([])}>取消勾選</button><button onClick={saveEdits}>儲存補 KEY</button><button onClick={saveFaxBatch}>產出傳真批次紀錄</button><button onClick={markPicked}>批次登錄已領件</button></div>
      <div className="hint">傳真排序：收費日期 → 收件編號 → 右上角外字末五碼。簽收單排序：承辦 → 雇主。</div>
      <div className="table-wrap"><table className="compact"><thead><tr><th></th><th>收費日</th><th>領件日</th><th>收件編號</th><th>IC卡</th><th>張數</th><th>經手人四碼</th><th>外字末五碼</th><th>舊卡</th><th>雇主</th><th>工人</th><th>承辦</th><th>領件狀況</th></tr></thead><tbody>{filtered.map(c0 => { const c = merged(c0); return <tr key={c.id}>
        <td><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(s => e.target.checked ? [...s, c.id] : s.filter(id => id !== c.id))} /></td>
        <td>{c.payment_date || c.application_date}</td><td><input type="date" value={c.pickup_date || pickupDate} onChange={e => patch(c.id, 'pickup_date', e.target.value)} /></td>
        <td><input value={c.receipt_no || ''} onChange={e => patch(c.id, 'receipt_no', e.target.value)} /></td><td className="center">☑</td>
        <td><input type="number" value={c.card_count || 1} onChange={e => patch(c.id, 'card_count', Number(e.target.value || 1))} /></td>
        <td><input value={c.handler_code || ''} maxLength={4} onChange={e => patch(c.id, 'handler_code', e.target.value)} /></td>
        <td><input value={c.foreign_code_last5 || ''} maxLength={5} onChange={e => patch(c.id, 'foreign_code_last5', e.target.value)} /></td>
        <td><input type="checkbox" checked={!!c.old_card} onChange={e => patch(c.id, 'old_card', e.target.checked)} /></td>
        <td>{c.employer_name}</td><td>{c.worker_name}</td><td>{c.handler_name}</td>
        <td><select value={c.pickup_status} onChange={e => patch(c.id, 'pickup_status', e.target.value)}><option value="pending">待領件</option><option value="picked">已領件</option><option value="hold">暫緩</option><option value="abnormal">異常</option></select></td>
      </tr>; })}</tbody></table></div>
    </section>
    <section className="print-tools no-print"><button onClick={() => printBlock('fax-print', '移民署傳真領件表')}>列印傳真表</button><button onClick={() => printBlock('receipt-print', '居留證領件簽收單')}>列印簽收單</button><button className="primary" onClick={() => printBlock('fax-and-receipt-print', '傳真表與簽收單')}>列印傳真 + 簽收單</button><span>已選 {selectedCases.length} 筆，總張數 {totalCards}</span></section>
    <div id="fax-and-receipt-print"><FaxPrint rows={faxRows} totalCards={totalCards} settings={settings} faxDate={faxDate} pickupDate={pickupDate} /><ReceiptPrint rows={receiptRows} totalCards={totalCards} pickupDate={pickupDate} /></div>
  </>;
}

function FaxPrint({ rows, totalCards, settings, faxDate, pickupDate }) {
  return <section className="print-page portrait" id="fax-print">
    <div className="print-head"><div><h2>桃園市服務站 移民署傳真領件表</h2><p>電話：{settings.taoyuan_station_phone}　傳真：{settings.taoyuan_station_fax}</p></div><div><p>傳真日期：{faxDate}</p><p>領件日期：{pickupDate}</p><p>總張數：{totalCards}</p></div></div>
    <table className="print-table"><thead><tr><th>編號</th><th>收費日期</th><th>收件編號</th><th>IC卡</th><th>張數</th><th>經手人四碼</th><th>外字末五碼</th><th>舊卡</th><th>雇主名稱</th><th>工人名稱</th><th>承辦</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.id}><td>{i+1}</td><td>{r.payment_date || r.application_date}</td><td>{r.receipt_no}</td><td>☑</td><td>{r.card_count || 1}</td><td>{r.handler_code}</td><td>{r.foreign_code_last5}</td><td>{r.old_card ? '☑' : ''}</td><td>{r.employer_name}</td><td>{r.worker_name}</td><td>{r.handler_name}</td></tr>)}</tbody></table>
    <div className="print-foot"><p>仲介公司名稱：{settings.fax_agency_name}</p><p>聯絡人：{settings.fax_contact_name || '　　　　　　'}　電話：{settings.fax_contact_phone}</p></div>
  </section>;
}

function ReceiptPrint({ rows, totalCards, pickupDate }) {
  const grouped = rows.reduce((acc, r) => { acc[r.handler_name] = acc[r.handler_name] || []; acc[r.handler_name].push(r); return acc; }, {});
  return <section className="print-page landscape" id="receipt-print">
    <div className="print-head"><div><h2>居留證領件簽收單</h2><p>領件日期：{pickupDate}　總張數：{totalCards}</p></div></div>
    <table className="print-table"><thead><tr><th>承辦</th><th>繳費日</th><th>領件日</th><th>收件號</th><th>雇主</th><th>工人</th><th>入境日</th><th>張數</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.handler_name}</td><td>{r.payment_date || r.application_date}</td><td>{r.pickup_date || pickupDate}</td><td>{r.receipt_no}</td><td>{r.employer_name}</td><td>{r.worker_name}</td><td>{r.entry_date}</td><td>{r.card_count || 1}</td></tr>)}</tbody></table>
    <div className="signature-grid">{Object.entries(grouped).map(([handler, list]) => <div className="signature" key={handler}><b>{handler}</b><span>張數：{list.reduce((s,r) => s + num(r.card_count || 1), 0)}</span><em>簽名：</em></div>)}</div>
  </section>;
}

function CaseSearchPage({ data, updateRow }) {
  const [q, setQ] = useState('');
  const cases = data.arc_cases.filter(c => !c.is_voided && (!q || `${c.case_no}${c.employer_name}${c.worker_name}${c.handler_name}${c.agency_short_name}${c.application_item_name}`.includes(q))).sort((a,b) => sortText(b.application_date,a.application_date));
  async function voidCase(c) {
    const reason = prompt('作廢原因');
    if (!reason) return;
    await updateRow('arc_cases', c.id, { is_voided: true, voided_at: new Date().toISOString(), voided_by: 'system', void_reason: reason }, 'void_case', reason);
  }
  return <section className="card"><h2>案件查詢</h2><div className="toolbar"><input placeholder="搜尋案件、雇主、工人、承辦、項目" value={q} onChange={e => setQ(e.target.value)} /></div><table><thead><tr><th>案件</th><th>仲介</th><th>承辦</th><th>雇主</th><th>工人</th><th>入境日</th><th>申請日</th><th>項目</th><th>繳款</th><th>領件</th><th></th></tr></thead><tbody>{cases.map(c => <tr key={c.id}><td>{c.case_no}</td><td>{c.agency_short_name}</td><td>{c.handler_name}</td><td>{c.employer_name}</td><td>{c.worker_name}</td><td>{c.entry_date}</td><td>{c.application_date}</td><td>{c.application_item_name}</td><td><PayTag c={c} /></td><td><PickupTag c={c} /></td><td><button className="danger mini" onClick={() => voidCase(c)}>作廢</button></td></tr>)}</tbody></table></section>;
}

function PayTag({ c }) { return c.payment_status === 'paid' ? <StatusTag tone="green">已繳款</StatusTag> : c.payment_status === 'no_payment' ? <StatusTag tone="blue">現場送件</StatusTag> : <StatusTag tone="red">待繳款</StatusTag>; }
function PickupTag({ c }) {
  if (c.pickup_status === 'download') return <StatusTag tone="gold">請至移民署線上下載居留證</StatusTag>;
  if (c.pickup_status === 'picked') return <StatusTag tone="green">已領件</StatusTag>;
  if (c.pickup_status === 'pending') return <StatusTag tone="blue">待領件</StatusTag>;
  if (c.pickup_status === 'hold') return <StatusTag tone="gold">暫緩</StatusTag>;
  if (c.pickup_status === 'abnormal') return <StatusTag tone="red">異常</StatusTag>;
  return <StatusTag>未產生</StatusTag>;
}

function StatisticsPage({ data, activeAgencies, activeHandlers }) {
  const month = today().slice(0,7), year = today().slice(0,4);
  const cases = data.arc_cases.filter(c => !c.is_voided);
  const batches = data.payment_batches.filter(b => b.financial_status !== 'voided');
  const monthTotal = batches.filter(b => String(b.payment_date || '').startsWith(month)).reduce((s,b)=>s+num(b.grand_total),0);
  const yearTotal = batches.filter(b => String(b.payment_date || '').startsWith(year)).reduce((s,b)=>s+num(b.grand_total),0);
  const byHandlerMonth = activeHandlers.map(h => [h.name, cases.filter(c => c.handler_name === h.name && String(c.application_date || '').startsWith(month)).length]);
  const byItem = Object.entries(cases.reduce((a,c)=>{a[c.application_item_name]=(a[c.application_item_name]||0)+1;return a;},{}));
  const agencyMonth = activeAgencies.map(a => [a.short_name, batches.filter(b => b.agency_short_name === a.short_name && String(b.payment_date || '').startsWith(month)).reduce((s,b)=>s+num(b.grand_total),0)]);
  const agencyYear = activeAgencies.map(a => [a.short_name, batches.filter(b => b.agency_short_name === a.short_name && String(b.payment_date || '').startsWith(year)).reduce((s,b)=>s+num(b.grand_total),0)]);
  const monthlyYear = Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`).map(m => [m, cases.filter(c=>String(c.application_date||'').startsWith(m)).length, batches.filter(b=>String(b.payment_date||'').startsWith(m)).reduce((s,b)=>s+num(b.grand_total),0)]);
  return <>
    <div className="kpis"><div className="kpi"><span>當月繳款總額</span><b>{money(monthTotal)}</b></div><div className="kpi"><span>當年繳款總額</span><b>{money(yearTotal)}</b></div><div className="kpi"><span>當月申請件數</span><b>{cases.filter(c=>String(c.application_date||'').startsWith(month)).length}</b></div><div className="kpi"><span>當年申請件數</span><b>{cases.filter(c=>String(c.application_date||'').startsWith(year)).length}</b></div></div>
    <section className="grid two"><StatTable title="每月每個人申請件數" rows={byHandlerMonth} heads={['承辦','件數']} /><StatTable title="各項申請數據" rows={byItem} heads={['申請項目','件數']} /><StatTable title="各仲介每月繳款總數" rows={agencyMonth} heads={['仲介','金額']} moneyCol={1} /><StatTable title="各仲介每年繳款總數" rows={agencyYear} heads={['仲介','金額']} moneyCol={1} /></section>
    <section className="card"><h2>每年數據</h2><table><thead><tr><th>月份</th><th>申請件數</th><th className="right">繳款總額</th></tr></thead><tbody>{monthlyYear.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td className="right">{money(r[2])}</td></tr>)}</tbody></table></section>
  </>;
}
function StatTable({ title, rows, heads, moneyCol }) { return <div className="card"><h2>{title}</h2><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className={moneyCol===j?'right':''}>{moneyCol===j?money(c):c}</td>)}</tr>)}</tbody></table></div>; }

function ExportDataPage({ data }) {
  const [year, setYear] = useState(today().slice(0,4)); const [month, setMonth] = useState(''); const [date, setDate] = useState(''); const [type, setType] = useState('cases');
  function matchDate(d) { if (date) return d === date; if (month) return String(d||'').startsWith(`${year}-${month}`); return String(d||'').startsWith(year); }
  function exportNow() {
    if (type === 'cases') {
      const rows = data.arc_cases.filter(c => matchDate(c.application_date)).map(c => [c.case_no,c.agency_short_name,c.handler_name,c.employer_name,c.worker_name,c.entry_date,c.application_date,c.group_no,c.application_item_name,c.amount,c.payment_status,c.pickup_status,c.receipt_no]);
      csvDownload(`案件_${year}${month}${date}.csv`, [['案件編號','仲介','承辦','雇主','工人','入境日','申請日','團號','項目','金額','繳款','領件','收件號'], ...rows]);
    } else {
      const rows = data.payment_batches.filter(b => matchDate(b.payment_date)).map(b => [b.batch_no,b.payment_date,b.agency_short_name,b.account_label,b.total_case_amount,b.fee,b.grand_total,b.financial_status,b.confirmed_by]);
      csvDownload(`繳費批次_${year}${month}${date}.csv`, [['批次','繳費日','仲介','帳號','明細金額','手續費','合計','狀態','確認人'], ...rows]);
    }
  }
  return <section className="card"><h2>匯出資料</h2><div className="form-grid"><label>年分<input value={year} onChange={e=>setYear(e.target.value)} /></label><label>月份<select value={month} onChange={e=>setMonth(e.target.value)}><option value="">全年</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{String(i+1).padStart(2,'0')}</option>)}</select></label><label>指定日期<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label>資料類型<select value={type} onChange={e=>setType(e.target.value)}><option value="cases">案件</option><option value="payments">繳費批次</option></select></label></div><button className="primary" onClick={exportNow}>匯出 CSV</button></section>;
}

function AgencyAccountsPage({ data, activeAgencies, activeAccounts, updateRow, insertRow, loadAll, log, deviceLock, flash }) {
  const [newAgency, setNewAgency] = useState({ code:'', short_name:'', full_name:'', phone:'', contact_name:'' });
  const [newAccount, setNewAccount] = useState({ agency_id:'', bank_code:'', bank_name:'', account_number:'', account_label:'', balance:0 });
  async function saveAgency(a, patch) { await updateRow('agencies', a.id, patch, 'update_agency'); flash('仲介資料已更新'); }
  async function addAgency() { if(!newAgency.code || !newAgency.short_name) return alert('請輸入代碼與簡稱'); await insertRow('agencies', { ...newAgency, display_order: 100 }); setNewAgency({ code:'', short_name:'', full_name:'', phone:'', contact_name:'' }); }
  async function addAccount() { if(!newAccount.agency_id || !newAccount.account_number) return alert('請選擇仲介並輸入帳號'); await insertRow('agency_accounts', { ...newAccount, balance:num(newAccount.balance), is_active:true }); setNewAccount({ agency_id:'', bank_code:'', bank_name:'', account_number:'', account_label:'', balance:0 }); }
  async function deleteAccount(a) { if(!confirm('確定停用此扣款帳號？')) return; await updateRow('agency_accounts', a.id, { is_active:false }, 'disable_account'); flash('扣款帳號已停用'); }
  async function adjustBalance(a) { const val = prompt('輸入新的帳戶餘額', a.balance); if(val === null) return; const before = num(a.balance); const after = num(val); await updateRow('agency_accounts', a.id, { balance: after }, 'manual_balance_adjust', '手動修改餘額'); await supabase.from('account_transactions').insert({ account_id:a.id, agency_id:a.agency_id, transaction_type:'manual_adjust', amount: after-before, balance_before: before, balance_after: after, created_by: deviceLock.handler_name, note:'手動修改餘額' }); await loadAll(); }
  return <>
    <section className="card"><h2>仲介資料維護</h2><table><thead><tr><th>代碼</th><th>簡稱</th><th>公司全名</th><th>聯絡人</th><th>電話</th><th></th></tr></thead><tbody>{activeAgencies.map(a=><tr key={a.id}><td><input value={a.code} onChange={e=>saveAgency(a,{code:e.target.value})}/></td><td><input value={a.short_name} onChange={e=>saveAgency(a,{short_name:e.target.value})}/></td><td><input value={a.full_name} onChange={e=>saveAgency(a,{full_name:e.target.value})}/></td><td><input value={a.contact_name||''} onChange={e=>saveAgency(a,{contact_name:e.target.value})}/></td><td><input value={a.phone||''} onChange={e=>saveAgency(a,{phone:e.target.value})}/></td><td><button className="danger mini" onClick={()=>saveAgency(a,{is_active:false})}>停用</button></td></tr>)}</tbody></table>
    <div className="toolbar"><input placeholder="代碼" value={newAgency.code} onChange={e=>setNewAgency({...newAgency,code:e.target.value})}/><input placeholder="簡稱" value={newAgency.short_name} onChange={e=>setNewAgency({...newAgency,short_name:e.target.value})}/><input placeholder="公司全名" value={newAgency.full_name} onChange={e=>setNewAgency({...newAgency,full_name:e.target.value})}/><input placeholder="電話" value={newAgency.phone} onChange={e=>setNewAgency({...newAgency,phone:e.target.value})}/><button onClick={addAgency}>新增仲介別</button></div></section>
    <section className="card"><h2>扣款帳號與餘額維護</h2><table><thead><tr><th>仲介</th><th>銀行</th><th>代碼</th><th>帳號</th><th>標籤</th><th className="right">餘額</th><th></th></tr></thead><tbody>{activeAccounts.map(a=>{ const agency=activeAgencies.find(x=>x.id===a.agency_id); return <tr key={a.id}><td>{agency?.short_name}</td><td>{a.bank_name}</td><td>{a.bank_code}</td><td><button className="linklike" onClick={()=>navigator.clipboard.writeText(a.account_number)}>{a.account_number}</button></td><td>{a.account_label}</td><td className="right">{money(a.balance)}</td><td><button className="mini" onClick={()=>adjustBalance(a)}>改餘額</button><button className="danger mini" onClick={()=>deleteAccount(a)}>刪除</button></td></tr>})}</tbody></table>
    <div className="toolbar"><select value={newAccount.agency_id} onChange={e=>setNewAccount({...newAccount,agency_id:e.target.value})}><option value="">選仲介</option>{activeAgencies.map(a=><option key={a.id} value={a.id}>{a.short_name}</option>)}</select><input placeholder="銀行" value={newAccount.bank_name} onChange={e=>setNewAccount({...newAccount,bank_name:e.target.value})}/><input placeholder="代碼" value={newAccount.bank_code} onChange={e=>setNewAccount({...newAccount,bank_code:e.target.value})}/><input placeholder="帳號" value={newAccount.account_number} onChange={e=>setNewAccount({...newAccount,account_number:e.target.value})}/><input placeholder="標籤" value={newAccount.account_label} onChange={e=>setNewAccount({...newAccount,account_label:e.target.value})}/><button onClick={addAccount}>新增帳號</button></div></section>
  </>;
}

function ContactsPage({ data, type, title }) {
  const [q,setQ]=useState('');
  const rows=data.contacts.filter(c=>c.contact_type===type && c.is_active && (!q || `${c.name}${c.address}${c.phone}${c.fax}`.includes(q))).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  return <section className="card"><h2>{title}</h2><div className="toolbar"><input placeholder="搜尋縣市、地址、電話、傳真" value={q} onChange={e=>setQ(e.target.value)} /></div><table><thead><tr><th>單位</th><th>地址</th><th>電話</th><th>傳真</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.address}</td><td>{r.phone}</td><td>{r.fax}</td><td><button className="mini" onClick={()=>navigator.clipboard.writeText(`${r.name}\n${r.address}\n${r.phone}\n${r.fax}`)}>複製</button></td></tr>)}</tbody></table></section>;
}

function SettingsPage({ data, settings, activeHandlers, activeItems, updateRow, insertRow, loadAll, log, setDeviceLock, deviceId, deviceLock, flash }) {
  const [newHandler,setNewHandler]=useState('');
  const [newItem,setNewItem]=useState({ name:'', default_amount:1000, requires_pickup:true, download_after_payment:false });
  const [unlockCode,setUnlockCode]=useState('');
  const [newHandlerId,setNewHandlerId]=useState('');
  const [reason,setReason]=useState('');
  async function setSetting(key,value){ const before=data.system_settings.find(s=>s.key===key)||{}; const {error}=await supabase.from('system_settings').upsert({key,value,updated_at:new Date().toISOString()}); if(error)return alert(error.message); await log('update_setting','system_settings',key,before,{key,value}); await loadAll(); flash('設定已更新'); }
  async function switchUser(){ if(unlockCode !== settings.admin_unlock_code) return alert('管理員解除碼錯誤'); const h=activeHandlers.find(x=>x.id===newHandlerId); if(!h) return alert('請選擇新使用者'); const before=deviceLock; const row={ device_id:deviceId, handler_id:h.id, handler_name:h.name, is_locked:true, updated_at:new Date().toISOString(), unlock_reason:reason, device_label:deviceLock.device_label || '' }; const {error}=await supabase.from('device_locks').upsert(row,{onConflict:'device_id'}); if(error)return alert(error.message); await log('admin_change_device_user','device_locks',deviceId,before,row,reason); setDeviceLock({...deviceLock,...row}); await loadAll(); flash('已由管理員更換本機使用者'); }
  return <>
    <section className="grid two"><div className="card"><h2>行政 / 承辦選項維護</h2><div className="chips">{activeHandlers.map(h=><span className="edit-chip" key={h.id}><input value={h.name} onChange={e=>updateRow('handlers',h.id,{name:e.target.value},'update_handler')} /><button onClick={()=>updateRow('handlers',h.id,{is_active:false},'disable_handler')}>×</button></span>)}</div><div className="toolbar"><input placeholder="新增承辦" value={newHandler} onChange={e=>setNewHandler(e.target.value)} /><button onClick={async()=>{ if(newHandler){ await insertRow('handlers',{name:newHandler,display_order:100}); setNewHandler(''); }}}>新增</button></div></div>
    <div className="card"><h2>系統基本設定</h2>{['default_fee','admin_unlock_code','taoyuan_station_phone','taoyuan_station_fax','fax_agency_name','fax_contact_name','fax_contact_phone'].map(k=><label key={k}>{k}<input defaultValue={settings[k]||''} onBlur={e=>setSetting(k,e.target.value)} /></label>)}</div></section>
    <section className="card"><h2>申請項目維護</h2><table><thead><tr><th>項目</th><th>預設金額</th><th>需領件</th><th>繳後下載</th><th></th></tr></thead><tbody>{activeItems.map(i=><tr key={i.id}><td><input value={i.name} onChange={e=>updateRow('application_items',i.id,{name:e.target.value},'update_item')}/></td><td><input type="number" value={i.default_amount} onChange={e=>updateRow('application_items',i.id,{default_amount:e.target.value},'update_item')}/></td><td><input type="checkbox" checked={i.requires_pickup} onChange={e=>updateRow('application_items',i.id,{requires_pickup:e.target.checked},'update_item')}/></td><td><input type="checkbox" checked={i.download_after_payment} onChange={e=>updateRow('application_items',i.id,{download_after_payment:e.target.checked},'update_item')}/></td><td><button className="danger mini" onClick={()=>updateRow('application_items',i.id,{is_active:false},'disable_item')}>停用</button></td></tr>)}</tbody></table><div className="toolbar"><input placeholder="項目名稱" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/><input type="number" value={newItem.default_amount} onChange={e=>setNewItem({...newItem,default_amount:e.target.value})}/><label className="inline"><input type="checkbox" checked={newItem.requires_pickup} onChange={e=>setNewItem({...newItem,requires_pickup:e.target.checked})}/>需領件</label><label className="inline"><input type="checkbox" checked={newItem.download_after_payment} onChange={e=>setNewItem({...newItem,download_after_payment:e.target.checked})}/>繳後下載</label><button onClick={async()=>{ if(newItem.name){ await insertRow('application_items',{...newItem,default_amount:num(newItem.default_amount)}); setNewItem({ name:'', default_amount:1000, requires_pickup:true, download_after_payment:false }); }}}>新增項目</button></div></section>
    <section className="card"><h2>本機使用者鎖定管理</h2><p>目前本機使用者：<b>{deviceLock.handler_name}</b>。一般操作不可更換，需管理員解除碼。</p><div className="toolbar"><input type="password" placeholder="管理員解除碼" value={unlockCode} onChange={e=>setUnlockCode(e.target.value)} /><select value={newHandlerId} onChange={e=>setNewHandlerId(e.target.value)}><option value="">新使用者</option>{activeHandlers.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><input placeholder="變更原因" value={reason} onChange={e=>setReason(e.target.value)} /><button className="primary" onClick={switchUser}>管理員更換使用者</button></div></section>
  </>;
}

function AuditPage({ data }) {
  const [q,setQ]=useState('');
  const rows=data.audit_logs.filter(a=>!q || `${a.actor_name}${a.action_type}${a.table_name}${a.reason}`.includes(q)).sort((a,b)=>sortText(b.created_at,a.created_at)).slice(0,300);
  return <section className="card"><h2>操作紀錄</h2><div className="toolbar"><input placeholder="搜尋操作者、動作、資料表、原因" value={q} onChange={e=>setQ(e.target.value)} /></div><table><thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>資料</th><th>原因</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{String(r.created_at).slice(0,19).replace('T',' ')}</td><td>{r.actor_name}</td><td>{r.action_type}</td><td>{r.table_name} / {r.record_id}</td><td>{r.reason}</td></tr>)}</tbody></table></section>;
}

function CaseMiniTable({ cases }) {
  return <table><thead><tr><th>案件</th><th>仲介</th><th>承辦</th><th>雇主</th><th>工人</th><th>項目</th><th>繳款</th><th>領件</th></tr></thead><tbody>{cases.map(c => <tr key={c.id}><td>{c.case_no}</td><td>{c.agency_short_name}</td><td>{c.handler_name}</td><td>{c.employer_name}</td><td>{c.worker_name}</td><td>{c.application_item_name}</td><td><PayTag c={c} /></td><td><PickupTag c={c} /></td></tr>)}</tbody></table>;
}
