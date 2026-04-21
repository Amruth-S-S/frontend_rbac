"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadialBarChart, RadialBar,
  LineChart, Line,
} from "recharts";

// ─── Constants ───────────────────────────────────────────────
const API_BASE = "https://obeyable-celina-provisorily.ngrok-free.dev";
const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const H        = { "accept":"application/json", "ngrok-skip-browser-warning":"true" };

// ─── Helpers ─────────────────────────────────────────────────
const fmtNum = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `₹${(v/1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `₹${(v/1_000).toFixed(0)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
};
const fmtFull = (v: any) => {
  if (v == null) return "—";
  if (typeof v === "number") return `₹${v.toLocaleString("en-IN", { minimumFractionDigits:2 })}`;
  return String(v);
};
const fmtVal = (k: string, v: any) => {
  if (v == null) return "—";
  if (k.includes("margin")||k.includes("ratio")||k.includes("percent")) return `${Number(v).toFixed(2)} %`;
  if (typeof v === "number") return fmtFull(v);
  return String(v);
};
const humanize = (k: string) => k.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase());

// ─── Custom Tooltip ──────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1.5px solid #e2e8f5", borderRadius:10, padding:"10px 14px", boxShadow:"0 4px 20px rgba(79,142,247,0.15)", fontSize:12 }}>
      {label && <div style={{ fontWeight:700, color:"#1a2340", marginBottom:6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:p.color||p.fill }} />
          <span style={{ color:"#7a8cb0" }}>{p.name}:</span>
          <span style={{ fontWeight:700, color:"#1a2340" }}>
            {typeof p.value === "number" ? fmtNum(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Loader ──────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:220 }}>
      <div style={{ width:32, height:32, border:"3px solid #e2e8f5", borderTopColor:"#4f8ef7", borderRadius:"50%", animation:"kpispin 0.7s linear infinite" }} />
    </div>
  );
}

// ─── Stat Row ────────────────────────────────────────────────
function StatRow({ label, value, accent, highlight }: { label:string; value:string; accent:string; highlight?:boolean }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding: highlight ? "8px 10px 8px 9px" : "7px 10px",
      borderRadius:8,
      background: highlight ? `${accent}0f` : "transparent",
      borderLeft: highlight ? `3px solid ${accent}` : "3px solid transparent",
    }}>
      <span style={{ fontSize:12, color:"#7a8cb0", fontWeight: highlight?600:400 }}>{label}</span>
      <span style={{ fontSize: highlight?14:13, fontWeight:700, color: highlight?accent:"#1a2340" }}>{value}</span>
    </div>
  );
}

// ─── Section Label ───────────────────────────────────────────
function SecLabel({ title }: { title:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, margin:"16px 0 10px" }}>
      <span style={{ fontSize:10, fontWeight:700, color:"#a0aac8", textTransform:"uppercase", letterSpacing:"0.8px" }}>{title}</span>
      <div style={{ flex:1, height:1, background:"#f0f4fd" }} />
    </div>
  );
}

// ─── Card Wrapper ────────────────────────────────────────────
const ACC = { blue:"#2563eb", green:"#16a34a", purple:"#7c3aed", amber:"#d97706" };
const LT  = { blue:"#eff6ff", green:"#f0fdf4", purple:"#faf5ff", amber:"#fffbeb" };

function Card({ title, icon, color, badge, loading, error, children }: {
  title:string; icon:string; color:keyof typeof ACC; badge?:string;
  loading:boolean; error:string|null; children?:React.ReactNode;
}) {
  const acc = ACC[color]; const lt = LT[color];
  return (
    <div style={{ background:"#fff", border:"1.5px solid #e2e8f5", borderRadius:18, overflow:"hidden",
      boxShadow:"0 2px 12px rgba(79,142,247,0.07)", borderTop:`3px solid ${acc}`,
      transition:"transform 0.2s,box-shadow 0.2s" }}
      onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.transform="translateY(-3px)";el.style.boxShadow="0 14px 36px rgba(79,142,247,0.13)";}}
      onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.transform="";el.style.boxShadow="0 2px 12px rgba(79,142,247,0.07)";}}
    >
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px 14px", borderBottom:"1px solid #f0f4fd" }}>
        <div style={{ width:40,height:40,borderRadius:11,background:lt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{icon}</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#1a2340" }}>{title}</div>
          {badge && <div style={{ fontSize:10, color:acc, background:lt, border:`1px solid ${acc}33`, borderRadius:4, padding:"1px 8px", display:"inline-block", marginTop:3, fontWeight:600 }}>{badge}</div>}
        </div>
      </div>
      <div style={{ padding:"16px 20px 20px" }}>
        {loading ? <Loader /> : error
          ? <div style={{ fontSize:12,color:"#dc2626",background:"#fef2f2",borderRadius:8,padding:"12px",textAlign:"center" }}>⚠ {error}</div>
          : children}
      </div>
    </div>
  );
}

// ─── SALES CARD ──────────────────────────────────────────────
function SalesCard({ data, loading, error, month }: { data:any; loading:boolean; error:string|null; month:string }) {
  const acc = ACC.blue;
  const chartData = data ? [
    { name:"Sales",        value: Math.abs(Number(data.sales       ?? data.total_sales    ?? 0)) },
    { name:"Purchases",    value: Math.abs(Number(data.purchases   ?? 0)) },
    { name:"Gross Profit", value: Math.abs(Number(data.gross_profit?? 0)) },
  ].filter(d=>d.value>0) : [];

  const rows = data
    ? Object.entries(data).filter(([k])=>k!=="month").map(([k,v])=>({
        label:humanize(k), value:fmtVal(k,v),
        highlight:["sales","total_sales","gross_profit"].includes(k)
      }))
    : [];

  return (
    <Card title="Sales KPI" icon="💰" color="blue" badge={month} loading={loading} error={error}>
      {chartData.length > 0 && (
        <>
          <SecLabel title="Performance Overview" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%" margin={{ top:5, right:10, left:10, bottom:5 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8ef7" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fd" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:"#8898c0", fontWeight:500 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtNum} tick={{ fontSize:10, fill:"#a0aac8" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(79,142,247,0.05)" }} />
              <Bar dataKey="value" fill="url(#salesGrad)" radius={[6,6,0,0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
      {rows.length > 0 && (
        <>
          <SecLabel title="Metrics" />
          {rows.map((r,i)=><StatRow key={i} label={r.label} value={r.value} accent={acc} highlight={r.highlight} />)}
        </>
      )}
    </Card>
  );
}

// ─── CASHFLOW CARD ───────────────────────────────────────────
function CashflowCard({ data, loading, error, month }: { data:any; loading:boolean; error:string|null; month:string }) {
  const acc = ACC.green;
  const debit  = Math.abs(Number(data?.debit_amount  ?? data?.debit  ?? 0));
  const credit = Math.abs(Number(data?.credit_amount ?? data?.credit ?? 0));
  const pieData = [
    { name:"Credit", value:credit, color:"#16a34a" },
    { name:"Debit",  value:debit,  color:"#4f8ef7" },
  ].filter(d=>d.value>0);

  const rows = data
    ? Object.entries(data).filter(([k])=>k!=="month").map(([k,v])=>({
        label:humanize(k), value:fmtVal(k,v),
        highlight:["net_cash_flow","net_cashflow"].includes(k)
      }))
    : [];

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return percent > 0.05 ? (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {`${(percent*100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <Card title="Cashflow KPI" icon="🔄" color="green" badge={month} loading={loading} error={error}>
      {pieData.length > 0 && (
        <>
          <SecLabel title="Debit vs Credit Split" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90}
                dataKey="value" labelLine={false} label={renderLabel}>
                {pieData.map((d,i)=><Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, color:"#7a8cb0" }} />
            </PieChart>
          </ResponsiveContainer>
        </>
      )}
      {rows.length > 0 && (
        <>
          <SecLabel title="Metrics" />
          {rows.map((r,i)=><StatRow key={i} label={r.label} value={r.value} accent={acc} highlight={r.highlight} />)}
        </>
      )}
    </Card>
  );
}

// ─── FUNDSFLOW CARD ──────────────────────────────────────────
function FundsflowCard({ data, loading, error, month }: { data:any; loading:boolean; error:string|null; month:string }) {
  const acc = ACC.purple;
  const entries = data ? Object.entries(data).filter(([k])=>k!=="month") : [];
  const chartData = entries
    .filter(([,v])=>typeof v==="number" && v!==0)
    .map(([k,v])=>({ name:humanize(k), value:Number(v) }));

  const rows = entries.map(([k,v])=>({
    label:humanize(k), value:fmtVal(k,v),
    highlight:["net_flow","net_funds_flow"].includes(k)
  }));

  return (
    <Card title="Funds Flow KPI" icon="📈" color="purple" badge={month} loading={loading} error={error}>
      {chartData.length > 0 && (
        <>
          <SecLabel title="Funds Flow Breakdown" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top:5, right:10, left:10, bottom:20 }}>
              <defs>
                <linearGradient id="ffGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fd" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:"#8898c0" }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={fmtNum} tick={{ fontSize:10, fill:"#a0aac8" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5}
                fill="url(#ffGrad)" dot={{ fill:"#7c3aed", r:4, strokeWidth:2, stroke:"#fff" }}
                activeDot={{ r:6, fill:"#7c3aed" }} name="Amount" />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
      {rows.length > 0 && (
        <>
          <SecLabel title="Metrics" />
          {rows.map((r,i)=><StatRow key={i} label={r.label} value={r.value} accent={acc} highlight={r.highlight} />)}
        </>
      )}
    </Card>
  );
}

// ─── P&L CARD ────────────────────────────────────────────────
function PLCard({ data, loading, error }: { data:any; loading:boolean; error:string|null }) {
  const acc = ACC.amber;
  const revenue  = Math.abs(Number(data?.total_revenue  ?? data?.revenue  ?? 0));
  const expenses = Math.abs(Number(data?.total_expenses ?? data?.expenses ?? 0));
  const gross    = Math.abs(Number(data?.gross_profit   ?? 0));
  const net      = Number(data?.net_profit ?? data?.profit ?? 0);
  const margin   = Number(data?.gross_margin ?? data?.profit_margin ?? (revenue>0?(gross/revenue)*100:0));

  const barData = [
    { name:"Revenue",  value:revenue,  fill:"#4f8ef7" },
    { name:"Expenses", value:expenses, fill:"#f59e0b" },
    { name:"Gross P.", value:gross,    fill:"#16a34a" },
    { name:"Net P.",   value:Math.abs(net), fill: net<0?"#ef4444":"#7c3aed" },
  ].filter(d=>d.value>0);

  const radialData = [{ name:"Margin", value: Math.min(Math.max(margin,0),100), fill:"#d97706" }];

  const rows = data
    ? Object.entries(data).map(([k,v])=>({
        label:humanize(k), value:fmtVal(k,v),
        highlight:["net_profit","gross_profit","profit"].includes(k)
      }))
    : [];

  return (
    <Card title="Profit & Loss KPI" icon="🏆" color="amber" loading={loading} error={error}>
      {barData.length > 0 && (
        <>
          <SecLabel title="Revenue vs Expenses" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barCategoryGap="30%" margin={{ top:5,right:10,left:10,bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fd" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11,fill:"#8898c0",fontWeight:500 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtNum} tick={{ fontSize:10,fill:"#a0aac8" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(245,158,11,0.05)" }} />
              <Bar dataKey="value" radius={[6,6,0,0]} name="Amount">
                {barData.map((d,i)=><Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {margin > 0 && (
            <>
              <SecLabel title="Profit Margin" />
              <div style={{ display:"flex", alignItems:"center", gap:20 }}>
                <ResponsiveContainer width={140} height={100}>
                  <RadialBarChart innerRadius={28} outerRadius={48} startAngle={180} endAngle={0}
                    data={[{ value:100, fill:"#f0f4fd" }, ...radialData]} cx="50%" cy="95%">
                    <RadialBar dataKey="value" cornerRadius={4} background={false} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div>
                  <div style={{ fontSize:28, fontWeight:800, color:"#d97706", lineHeight:1 }}>{margin.toFixed(1)}%</div>
                  <div style={{ fontSize:11, color:"#8898c0", marginTop:4 }}>Gross Margin</div>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {rows.length > 0 && (
        <>
          <SecLabel title="Metrics" />
          {rows.map((r,i)=><StatRow key={i} label={r.label} value={r.value} accent={acc} highlight={r.highlight} />)}
        </>
      )}
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function KPIDashboard() {
  const currentMonth = MONTHS[new Date().getMonth()];
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [salesData,     setSalesData]     = useState<any>(null);
  const [cashflowData,  setCashflowData]  = useState<any>(null);
  const [fundsflowData, setFundsflowData] = useState<any>(null);
  const [plData,        setPlData]        = useState<any>(null);

  const [lS,setLS]=useState(false),[lC,setLC]=useState(false),[lF,setLF]=useState(false),[lP,setLP]=useState(false);
  const [eS,setES]=useState<string|null>(null),[eC,setEC]=useState<string|null>(null),[eF,setEF]=useState<string|null>(null),[eP,setEP]=useState<string|null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date|null>(null);

  const fetchAll = useCallback(async () => {
    setLS(true); setES(null);
    try   { const r=await fetch(`${API_BASE}/kpi/sales/${selectedMonth}`,{headers:H});     if(!r.ok) throw new Error(`HTTP ${r.status}`); setSalesData(await r.json()); }
    catch(e:any){ setES(e.message); } finally { setLS(false); }

    setLC(true); setEC(null);
    try   { const r=await fetch(`${API_BASE}/kpi/cashflow/${selectedMonth}`,{headers:H});  if(!r.ok) throw new Error(`HTTP ${r.status}`); setCashflowData(await r.json()); }
    catch(e:any){ setEC(e.message); } finally { setLC(false); }

    setLF(true); setEF(null);
    try   { const r=await fetch(`${API_BASE}/kpi/fundsflow/${selectedMonth}`,{headers:H}); if(!r.ok) throw new Error(`HTTP ${r.status}`); setFundsflowData(await r.json()); }
    catch(e:any){ setEF(e.message); } finally { setLF(false); }

    setLP(true); setEP(null);
    try   { const r=await fetch(`${API_BASE}/kpi/profitloss`,{headers:H});                if(!r.ok) throw new Error(`HTTP ${r.status}`); setPlData(await r.json()); }
    catch(e:any){ setEP(e.message); } finally { setLP(false); }

    setLastRefreshed(new Date());
  }, [selectedMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const anyLoading = lS||lC||lF||lP;

  const heroTiles = [
    { label:"Total Sales",    value:lS?"…":fmtNum(salesData?.sales??salesData?.total_sales??0),               color:"blue",   icon:"💰" },
    { label:"Net Cashflow",   value:lC?"…":fmtNum(cashflowData?.net_cash_flow??cashflowData?.net_cashflow??0), color:"green",  icon:"🔄" },
    { label:"Net Funds Flow", value:lF?"…":fmtNum(fundsflowData?.net_flow??fundsflowData?.net_funds_flow??0),  color:"purple", icon:"📈" },
    { label:"Net Profit",     value:lP?"…":fmtNum(plData?.net_profit??plData?.profit??0),                      color:"amber",  icon:"🏆" },
  ];

  return (
    <>
      <style>{`
        @keyframes kpispin { to { transform:rotate(360deg); } }
        .kd-wrap *, .kd-wrap *::before, .kd-wrap *::after { box-sizing:border-box; margin:0; padding:0; }
        .kd-wrap { min-height:100vh; background:#f4f7fe; font-family:'Segoe UI',sans-serif; padding-bottom:56px; color:#1a2340; }

        /* ── topbar ── */
        .kd-tb { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:14px 28px; background:#fff; border-bottom:1px solid #e2e8f5; box-shadow:0 1px 6px rgba(79,142,247,0.07); position:sticky; top:0; z-index:20; }
        .kd-tb__brand { display:flex; align-items:center; gap:10px; }
        .kd-tb__logo  { width:38px; height:38px; background:linear-gradient(135deg,#4f8ef7,#2563eb); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 4px 12px rgba(79,142,247,0.3); }
        .kd-tb__title    { font-size:15px; font-weight:700; color:#1a2340; }
        .kd-tb__subtitle { font-size:11px; color:#8898c0; margin-top:1px; }
        .kd-tb__ctrl { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .kd-ts { font-size:10px; color:#a0aac8; white-space:nowrap; }

        .kd-sel { background:#fff; border:1.5px solid #d0d9f0; color:#3a4a70; border-radius:8px; padding:7px 32px 7px 12px; font-size:13px; font-family:inherit; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='%236b7a9e'%3E%3Cpath d='M5 6 0 0h10z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; outline:none; transition:border-color .2s,box-shadow .2s; }
        .kd-sel:focus { border-color:#4f8ef7; box-shadow:0 0 0 3px rgba(79,142,247,.12); }

        .kd-btn { display:flex; align-items:center; gap:6px; background:linear-gradient(135deg,#4f8ef7,#2563eb); color:#fff; border:none; border-radius:8px; padding:7px 16px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; box-shadow:0 3px 10px rgba(79,142,247,.3); transition:opacity .2s,transform .15s; }
        .kd-btn:hover   { opacity:.92; transform:translateY(-1px); }
        .kd-btn:active  { transform:translateY(0); }
        .kd-btn:disabled{ opacity:.5; cursor:not-allowed; transform:none; }
        .kd-spin { display:inline-block; }
        .kd-btn:disabled .kd-spin { animation:kpispin .8s linear infinite; }

        /* ── hero ── */
        .kd-hero { padding:24px 28px 8px; display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        @media(max-width:900px){ .kd-hero{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:500px){ .kd-hero{ grid-template-columns:1fr; } }

        .kd-ht { background:#fff; border:1.5px solid #e2e8f5; border-radius:14px; padding:18px; display:flex; align-items:center; gap:14px; position:relative; overflow:hidden; box-shadow:0 2px 8px rgba(79,142,247,.05); transition:transform .2s,box-shadow .2s; }
        .kd-ht:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(79,142,247,.12); }
        .kd-ht::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:14px 14px 0 0; }
        .kd-ht--blue::before   { background:linear-gradient(90deg,#4f8ef7,#60a5fa); }
        .kd-ht--green::before  { background:linear-gradient(90deg,#16a34a,#22c55e); }
        .kd-ht--purple::before { background:linear-gradient(90deg,#7c3aed,#a855f7); }
        .kd-ht--amber::before  { background:linear-gradient(90deg,#d97706,#f59e0b); }

        .kd-ht__ico { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
        .kd-ht--blue   .kd-ht__ico { background:#eff6ff; }
        .kd-ht--green  .kd-ht__ico { background:#f0fdf4; }
        .kd-ht--purple .kd-ht__ico { background:#faf5ff; }
        .kd-ht--amber  .kd-ht__ico { background:#fffbeb; }

        .kd-ht__lbl { font-size:10px; color:#8898c0; text-transform:uppercase; letter-spacing:.8px; font-weight:600; }
        .kd-ht__val { font-size:20px; font-weight:800; margin-top:3px; letter-spacing:-.4px; }
        .kd-ht--blue   .kd-ht__val { color:#2563eb; }
        .kd-ht--green  .kd-ht__val { color:#16a34a; }
        .kd-ht--purple .kd-ht__val { color:#7c3aed; }
        .kd-ht--amber  .kd-ht__val { color:#d97706; }

        /* ── section ── */
        .kd-sh { padding:28px 28px 12px; display:flex; align-items:center; gap:12px; }
        .kd-sh h2 { font-size:11px; font-weight:700; color:#a0aac8; text-transform:uppercase; letter-spacing:1.2px; white-space:nowrap; }
        .kd-sh__line { flex:1; height:1px; background:#e2e8f5; }
        .kd-sh__chip { background:#eff6ff; color:#2563eb; border:1.5px solid #bfdbfe; border-radius:20px; padding:3px 12px; font-size:11px; font-weight:600; white-space:nowrap; }

        /* ── grid ── */
        .kd-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; padding:0 28px; }
        @media(max-width:750px){ .kd-grid{ grid-template-columns:1fr; } }

        .kd-foot { text-align:center; padding:32px 28px 8px; font-size:11px; color:#c0cae0; }

        @media(max-width:600px){
          .kd-tb   { padding:12px 16px; }
          .kd-hero { padding:16px 16px 4px; }
          .kd-grid { padding:0 16px; }
          .kd-sh   { padding:20px 16px 10px; }
        }
      `}</style>

      <div className="kd-wrap">

        {/* ── Topbar ── */}
        <div className="kd-tb">
          <div className="kd-tb__brand">
            <div className="kd-tb__logo">📊</div>
            <div>
              <div className="kd-tb__title">KPI Dashboard</div>
              <div className="kd-tb__subtitle">Financial Performance Overview</div>
            </div>
          </div>
          <div className="kd-tb__ctrl">
            {lastRefreshed && <span className="kd-ts">Updated {lastRefreshed.toLocaleTimeString()}</span>}
            <select className="kd-sel" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>
              {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <button className="kd-btn" onClick={fetchAll} disabled={anyLoading}>
              <span className="kd-spin">↻</span>
              {anyLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="kd-hero">
          {heroTiles.map(t=>(
            <div key={t.label} className={`kd-ht kd-ht--${t.color}`}>
              <div className="kd-ht__ico">{t.icon}</div>
              <div>
                <div className="kd-ht__lbl">{t.label}</div>
                <div className="kd-ht__val">{t.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Section ── */}
        <div className="kd-sh">
          <h2>Detailed KPIs</h2>
          <span className="kd-sh__chip">{selectedMonth}</span>
          <div className="kd-sh__line" />
        </div>

        {/* ── Cards ── */}
        <div className="kd-grid">
          <SalesCard    data={salesData}     loading={lS} error={eS} month={selectedMonth} />
          <CashflowCard data={cashflowData}  loading={lC} error={eC} month={selectedMonth} />
          <FundsflowCard data={fundsflowData} loading={lF} error={eF} month={selectedMonth} />
          <PLCard       data={plData}        loading={lP} error={eP} />
        </div>

        <div className="kd-foot">Data sourced from GBusiness Platform API · {new Date().getFullYear()}</div>
      </div>
    </>
  );
}