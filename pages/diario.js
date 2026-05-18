import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const REASONS = [
  {v:'institucional',l:'Punto institucional',e:'🏛️'},
  {v:'oraculo',l:'Oráculo',e:'🔮'},
  {v:'10min',l:'10 minutos',e:'⏱️'},
  {v:'ruptura',l:'Punto de ruptura',e:'💥'},
  {v:'estructura',l:'Estructura',e:'🟧'},
]
const MISTAKES = [
  'Moví mi stop loss más lejos','Quité el stop loss','Entré sin confirmación',
  'Entré tarde (FOMO)','Entré antes de tiempo','Entré fuera de mi zona',
  'Entré sin ver el contexto (tendencia / estructura)',
]
const EMOTIONS = {
  descontrol:{l:'Descontrol',c:'#f87171',bg:'rgba(248,113,113,0.07)',bd:'rgba(248,113,113,0.25)',s:'Miedo, presión, impulsividad',
    opts:[{v:'ansioso',l:'Ansioso',e:'😰'},{v:'miedoso',l:'Miedoso',e:'😨'},{v:'frustrado',l:'Frustrado',e:'😤'}]},
  claridad:{l:'Claridad',c:'#60a5fa',bg:'rgba(96,165,250,0.07)',bd:'rgba(96,165,250,0.25)',s:'Paciencia, orden, control',
    opts:[{v:'tranquilo',l:'Tranquilo',e:'😌'},{v:'neutral',l:'Neutral',e:'😐'}]},
  euforia:{l:'Euforia',c:'#4ade80',bg:'rgba(74,222,128,0.07)',bd:'rgba(74,222,128,0.25)',s:'Confianza alta, ojo con exceso',
    opts:[{v:'confiado',l:'Confiado',e:'😎'}]},
}
const TL_CONFIG = {
  verde:{c:'#4ade80',bg:'rgba(74,222,128,0.06)',bd:'rgba(74,222,128,0.2)',msg:'VERDE — Operar normal',hint:'Estás enfocado. No fuerces, deja que el trade llegue.'},
  amarillo:{c:'#fbbf24',bg:'rgba(251,191,36,0.06)',bd:'rgba(251,191,36,0.2)',msg:'AMARILLO — Modo defensivo',hint:'Máx 3 trades, 1 contrato. El día anterior fue duro.'},
  rojo:{c:'#f87171',bg:'rgba(248,113,113,0.06)',bd:'rgba(248,113,113,0.2)',msg:'ROJO — No operes hoy',hint:'Descansa. Proteger la cuenta es la mejor operación.'},
}
const RULES = [
  ['Stop loss fijo','$50 / trade'],['Target mínimo','$75 — R:R 1.5:1'],
  ['Pérdida diaria máx.','$150'],['MLL (quema cuenta)','$1,000'],
  ['Contratos máx.','1–2 MNQ'],['Trades por día','1–3'],
  ['Sesión principal','15:45–17:30h'],['Sesión secundaria','19:00–20:30h'],
]

const freshForm = () => ({
  date: new Date().toISOString().split('T')[0],
  session:'principal', direction:'long', entry:'', exit:'',
  contracts:1, pnl:'', entry_reasons:[], emotion:'neutral',
  emotion_category:'claridad', followed_plan:true, mistakes:[], notes:'',
})

const pc = v => parseFloat(v)>=0?'#4ade80':'#f87171'

function getWeekStart(ds) {
  const d=new Date(ds+'T12:00:00'); const day=d.getDay()
  const diff=d.getDate()-day+(day===0?-6:1)
  const m=new Date(d); m.setDate(diff); return m.toISOString().split('T')[0]
}
function weekLabel(k) {
  const d=new Date(k+'T12:00:00'); const e=new Date(d); e.setDate(d.getDate()+4)
  return `${d.getDate()}/${d.getMonth()+1} – ${e.getDate()}/${e.getMonth()+1}`
}
function groupByWeek(trades) {
  const w={}
  trades.forEach(t=>{ const k=getWeekStart(t.date); if(!w[k])w[k]=[]; w[k].push(t) })
  return w
}

export default function Diario() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [trades, setTrades] = useState([])
  const [form, setForm] = useState(freshForm())
  const [tab, setTab] = useState('registro')
  const [tl, setTl] = useState('verde')
  const [activeWeek, setActiveWeek] = useState(null)
  const [coachText, setCoachText] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setUser(session.user)
      loadTrades(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadTrades(uid) {
    const { data } = await supabase.from('trades').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  async function saveTrade() {
    if (!form.pnl) { showToast('Ingresa el resultado ($)'); return }
    setSaving(true)
    const { data, error } = await supabase.from('trades').insert([{ ...form, user_id: user.id }]).select()
    if (!error && data) {
      setTrades(prev => [data[0], ...prev])
      setForm(freshForm())
      showToast('✓ Trade guardado')
    } else { showToast('Error al guardar') }
    setSaving(false)
  }

  async function deleteTrade(id) {
    await supabase.from('trades').delete().eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  async function runCoach() {
    if (!trades.length) { setCoachText('Registra al menos un trade para activar el coach.'); return }
    setCoachLoading(true); setCoachText('')
    try {
      const res = await fetch('/api/coach', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trades }) })
      const data = await res.json()
      setCoachText(data.result || data.error || 'Sin respuesta.')
    } catch { setCoachText('Error al conectar. Intenta de nuevo.') }
    setCoachLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function exportTrades() {
    const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), trades }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mnq_backup_${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  async function importTrades(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const imported = parsed.trades || parsed
        if (!Array.isArray(imported)) throw new Error()
        const rows = imported.map(t => ({ ...t, id: undefined, user_id: user.id, created_at: undefined }))
        const { data } = await supabase.from('trades').insert(rows).select()
        if (data) { setTrades(prev => [...data, ...prev]); showToast(`✓ ${data.length} trades importados`) }
      } catch { showToast('✗ Archivo inválido') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  // Derived stats
  const totalPnl = trades.reduce((a,t)=>a+(parseFloat(t.pnl)||0),0)
  const winners = trades.filter(t=>parseFloat(t.pnl)>0)
  const winRate = trades.length ? Math.round((winners.length/trades.length)*100) : 0
  const progress = Math.min(100,Math.max(0,Math.round((totalPnl/1250)*100)))
  const today = new Date().toISOString().split('T')[0]
  const dailyPnl = trades.filter(t=>t.date===today).reduce((a,t)=>a+(parseFloat(t.pnl)||0),0)
  const riskUsed = Math.abs(Math.min(0,dailyPnl))
  const riskPct = Math.min(100,Math.round((riskUsed/150)*100))
  const riskColor = riskPct>66?'#f87171':riskPct>33?'#fbbf24':'#4ade80'
  const todayCount = trades.filter(t=>t.date===today).length
  const tlCfg = TL_CONFIG[tl]
  const weeks = groupByWeek(trades)
  const weekKeys = Object.keys(weeks).sort().reverse()
  const aw = activeWeek || weekKeys[0] || null
  const wt = aw ? weeks[aw]||[] : []
  const weekPnl = wt.reduce((a,t)=>a+(parseFloat(t.pnl)||0),0)
  const weekWinners = wt.filter(t=>parseFloat(t.pnl)>0)
  const weekWinRate = wt.length ? Math.round((weekWinners.length/wt.length)*100) : 0
  const sp = {principal:0,secundaria:0}
  wt.forEach(t=>{ sp[t.session]=(sp[t.session]||0)+(parseFloat(t.pnl)||0) })
  const bestSession = sp.principal>=sp.secundaria?'Principal':'Secundaria'
  const ec = {}; wt.forEach(t=>{ ec[t.emotion]=(ec[t.emotion]||0)+1 })
  const domEmotion = Object.entries(ec).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
  const followedPct = wt.length ? Math.round((wt.filter(t=>t.followed_plan).length/wt.length)*100) : 0

  const s = {
    card: {background:'#12161f',border:'1px solid #1e2535',borderRadius:14,padding:20,marginBottom:14},
    innerCard: {background:'#0f1219',border:'1px solid #1e2535',borderRadius:10,padding:16,marginBottom:14},
    secLabel: {fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',color:'#4a5568',fontWeight:700,marginBottom:8},
    fieldLabel: {fontSize:10,letterSpacing:'0.12em',textTransform:'uppercase',color:'#64748b',fontWeight:700,marginBottom:6,display:'block'},
    input: {background:'#1a1f2e',color:'#e2e8f0',border:'1px solid #252d3d',borderRadius:8,padding:'12px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:13,width:'100%',marginBottom:0,outline:'none'},
    saveBtn: {width:'100%',background:'linear-gradient(135deg,#7c3aed,#6366f1,#06b6d4)',color:'#fff',border:'none',borderRadius:10,padding:17,fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:800,cursor:'pointer',letterSpacing:'0.1em',marginTop:6},
    ptrack: {height:7,background:'#1e2535',borderRadius:4,overflow:'hidden',marginTop:8},
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0d13',color:'#64748b',flexDirection:'column',gap:10}}>
      <div style={{fontSize:32}}>📈</div>
      <div>Cargando tu diario...</div>
    </div>
  )

  return (
    <div style={{fontFamily:'Syne,sans-serif',background:'#0a0d13',minHeight:'100vh',color:'#e2e8f0'}}>

      {/* HEADER */}
      <div style={{maxWidth:880,margin:'0 auto',padding:'14px 14px 0'}}>
        <div style={{background:'#12161f',borderRadius:20,padding:'18px 22px 0',border:'1px solid #1e2535'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:46,height:46,borderRadius:12,background:'linear-gradient(135deg,#3b82f6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📈</div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:20,fontWeight:800,letterSpacing:'-0.02em'}}>MNQ DIARIO</span>
                  <span style={{background:'#1a1f2e',border:'1px solid #252d3d',borderRadius:7,padding:'3px 10px',fontSize:11,color:'#94a3b8'}}>Lucid 25K</span>
                  {saving && <span style={{fontSize:11,color:'#6366f1',fontFamily:'JetBrains Mono'}}>guardando...</span>}
                </div>
                <div style={{fontSize:9,color:'#4a5568',letterSpacing:'0.14em',textTransform:'uppercase',fontWeight:600,marginTop:2}}>Evaluación · {user?.email}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {[
                {l:'WIN RATE',v:`${winRate}%`,c:winRate>=50?'#4ade80':'#f87171'},
                {l:'P&L TOTAL',v:`${totalPnl>=0?'+':''}$${totalPnl.toFixed(0)}`,c:pc(totalPnl)},
                {l:'TRADES',v:String(trades.length),c:'#e2e8f0'},
              ].map(m=>(
                <div key={m.l} style={{background:'#1a1f2e',border:'1px solid #1e2535',borderRadius:10,padding:'10px 14px',minWidth:78}}>
                  <div style={{fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'#4a5568',fontWeight:700,marginBottom:3}}>{m.l}</div>
                  <div style={{fontSize:17,fontWeight:800,fontFamily:'JetBrains Mono',color:m.c}}>{m.v}</div>
                </div>
              ))}
              <button onClick={async()=>{await supabase.auth.signOut();router.push('/')}} style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:8,padding:'8px 14px',fontFamily:'Syne',fontSize:12,fontWeight:700,cursor:'pointer'}}>Salir</button>
            </div>
          </div>
          <div style={{display:'flex',borderTop:'1px solid #1e2535',overflowX:'auto'}}>
            {[['registro','✏️ Registrar'],['historial','📋 Historial'],['semana','📅 Semana'],['coach','🤖 Coach IA'],['stats','📊 Stats']].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{background:'transparent',border:'none',color:tab===id?'#e2e8f0':'#4a5568',fontFamily:'Syne',fontSize:12,fontWeight:600,padding:'12px 16px',cursor:'pointer',borderBottom:tab===id?'2px solid #6366f1':'2px solid transparent',whiteSpace:'nowrap',background:tab===id?'rgba(99,102,241,0.06)':'transparent'}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:880,margin:'0 auto',padding:14}}>

        {/* ── REGISTRO ── */}
        {tab==='registro' && (<>
          {/* Semáforo */}
          <div style={{...s.card,border:`1px solid ${tlCfg.bd}`,background:tlCfg.bg}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={s.secLabel}>Semáforo del día</div>
                <div style={{fontSize:15,fontWeight:700,color:tlCfg.c,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:9,height:9,borderRadius:'50%',background:tlCfg.c,display:'inline-block',boxShadow:`0 0 7px ${tlCfg.c}`}}></span>
                  {tlCfg.msg}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={s.secLabel}>P&L hoy</div>
                <div style={{fontSize:22,fontWeight:800,color:pc(dailyPnl),fontFamily:'JetBrains Mono'}}>{dailyPnl>=0?'+':''}${dailyPnl.toFixed(0)}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {['verde','amarillo','rojo'].map(k=>{
                const cfg=TL_CONFIG[k]; const active=tl===k
                return <button key={k} onClick={()=>setTl(k)} style={{flex:1,border:`1px solid ${active?cfg.c:'#252d3d'}`,borderRadius:8,padding:'9px',fontFamily:'Syne',fontSize:12,fontWeight:600,cursor:'pointer',background:active?`${cfg.c}1e`:'#1a1f2e',color:active?cfg.c:'#64748b'}}>● {k.charAt(0).toUpperCase()+k.slice(1)}</button>
              })}
            </div>
            <div style={{background:'rgba(0,0,0,0.2)',borderRadius:7,padding:'8px 12px',fontSize:12,color:'#94a3b8',marginBottom:10}}>💡 {tlCfg.hint}</div>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700,marginBottom:5}}>
              Riesgo consumido · <span style={{fontFamily:'JetBrains Mono',color:riskColor}}>${riskUsed.toFixed(0)} / $150 — {riskPct}%</span>
            </div>
            <div style={s.ptrack}><div style={{height:'100%',borderRadius:4,width:`${riskPct}%`,background:riskColor,transition:'width 0.4s'}}></div></div>
            <div style={{fontSize:11,color:'#4a5568',marginTop:5}}>Trades hoy: <span style={{fontFamily:'JetBrains Mono'}}>{todayCount}</span> · Margen restante: <span style={{fontFamily:'JetBrains Mono',color:'#e2e8f0'}}>${Math.max(0,150+Math.min(0,dailyPnl)).toFixed(0)}</span></div>
          </div>

          <div style={s.card}>
            <div style={s.secLabel}>Nuevo trade</div>
            <div style={{fontSize:26,fontWeight:800,letterSpacing:'-0.02em',marginBottom:20}}>Registra tu ejecución</div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>Fecha</label>
              <input style={s.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 90px',gap:12,marginBottom:16}}>
              <div>
                <label style={s.fieldLabel}>Sesión</label>
                <select style={s.input} value={form.session} onChange={e=>setForm({...form,session:e.target.value})}>
                  <option value="principal">● New York</option>
                  <option value="secundaria">● Secundaria</option>
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Dirección</label>
                <div style={{display:'flex',gap:7}}>
                  {[['long','▲ COMPRA','#4ade80'],['short','▼ VENTA','#f87171']].map(([d,l,c])=>(
                    <button key={d} onClick={()=>setForm({...form,direction:d})} style={{flex:1,border:`1px solid ${form.direction===d?c:'#252d3d'}`,borderRadius:8,padding:'12px 6px',fontFamily:'Syne',fontSize:13,fontWeight:700,cursor:'pointer',background:form.direction===d?`${c}1e`:'#1a1f2e',color:form.direction===d?c:'#64748b'}}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.fieldLabel}>Contratos</label>
                <select style={s.input} value={form.contracts} onChange={e=>setForm({...form,contracts:parseInt(e.target.value)})}>
                  <option value={1}>1</option><option value={2}>2</option>
                </select>
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>Resultado ($)</label>
              <input style={s.input} type="number" placeholder="-50 o +100" value={form.pnl} onChange={e=>setForm({...form,pnl:e.target.value})} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div><label style={s.fieldLabel}>Precio entrada</label><input style={s.input} type="number" placeholder="21400" value={form.entry} onChange={e=>setForm({...form,entry:e.target.value})} /></div>
              <div><label style={s.fieldLabel}>Precio salida</label><input style={s.input} type="number" placeholder="21450" value={form.exit} onChange={e=>setForm({...form,exit:e.target.value})} /></div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>Razón de entrada</label>
              <div>
                {REASONS.map(r=>{
                  const active=form.entry_reasons.includes(r.v)
                  return <button key={r.v} onClick={()=>setForm(p=>({...p,entry_reasons:p.entry_reasons.includes(r.v)?p.entry_reasons.filter(x=>x!==r.v):[...p.entry_reasons,r.v]}))} style={{background:active?'rgba(99,102,241,0.15)':'#1a1f2e',border:`1px solid ${active?'#6366f1':'#252d3d'}`,borderRadius:7,padding:'8px 12px',fontFamily:'Syne',fontSize:12,fontWeight:600,color:active?'#a5b4fc':'#64748b',cursor:'pointer',marginRight:7,marginBottom:7}}>{r.e} {r.l}</button>
                })}
              </div>
            </div>

            <div style={s.innerCard}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div>
                  <div style={{...s.secLabel,marginBottom:2}}>Checklist de malas prácticas</div>
                  <div style={{fontSize:11,color:'#64748b'}}>Marca los errores cometidos en este trade.</div>
                </div>
                <div style={{background:'#1a1f2e',border:'1px solid #252d3d',borderRadius:7,padding:'4px 10px',fontSize:10,color:'#64748b',flexShrink:0,marginLeft:10,whiteSpace:'nowrap'}}>
                  {form.mistakes.length===0?'Sin errores':`${form.mistakes.length} error${form.mistakes.length>1?'es':''}`}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:12}}>
                {MISTAKES.map((m,i)=>{
                  const active=form.mistakes.includes(i)
                  return (
                    <button key={i} onClick={()=>setForm(p=>({...p,mistakes:p.mistakes.includes(i)?p.mistakes.filter(x=>x!==i):[...p.mistakes,i]}))} style={{background:active?'rgba(248,113,113,0.08)':'#1a1f2e',border:`1px solid ${active?'rgba(248,113,113,0.4)':'#252d3d'}`,borderRadius:8,padding:'11px 12px',fontFamily:'Syne',fontSize:11,color:active?'#fca5a5':'#94a3b8',cursor:'pointer',display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left'}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${active?'#f87171':'#2d3748'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,background:active?'#f87171':'transparent',color:'#fff'}}>{active?'✓':''}</div>
                      <span>{m}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>Estado emocional</label>
              {Object.entries(EMOTIONS).map(([k,cat])=>(
                <div key={k} style={{borderRadius:10,padding:'14px 16px',marginBottom:8,border:`1px solid ${cat.bd}`,background:cat.bg}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:cat.c,display:'inline-block'}}></span>
                      <span style={{fontWeight:700,color:cat.c,fontSize:14}}>{cat.l}</span>
                    </div>
                    <span style={{fontSize:11,color:'#64748b'}}>{cat.s}</span>
                  </div>
                  <div>
                    {cat.opts.map(o=>{
                      const sel=form.emotion===o.v
                      return <button key={o.v} onClick={()=>setForm({...form,emotion:o.v,emotion_category:k})} style={{border:`1px solid ${sel?cat.c:'#252d3d'}`,borderRadius:20,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5,marginRight:7,marginTop:7,background:sel?cat.bg:'transparent',color:sel?cat.c:'#94a3b8'}}>{o.e} {o.l}</button>
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>¿Seguiste el plan?</label>
              <div style={{display:'flex',gap:8}}>
                {[[true,'✅ Sí','#6366f1','rgba(99,102,241,0.15)'],[false,'✗ No','#f87171','rgba(248,113,113,0.1)']].map(([v,l,c,bg])=>(
                  <button key={String(v)} onClick={()=>setForm({...form,followed_plan:v})} style={{flex:1,border:`1px solid ${form.followed_plan===v?c:'#252d3d'}`,borderRadius:8,padding:13,fontFamily:'Syne',fontSize:13,fontWeight:700,cursor:'pointer',background:form.followed_plan===v?bg:'#1a1f2e',color:form.followed_plan===v?c:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.fieldLabel}>Notas</label>
              <textarea style={{...s.input,resize:'vertical'}} rows={3} placeholder="¿Qué pasó? ¿Qué aprendiste? ¿Dónde estuvo el fallo o el acierto?" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            </div>

            <button style={s.saveBtn} onClick={saveTrade} disabled={saving}>{saving?'Guardando...':'GUARDAR TRADE'}</button>
          </div>
        </>)}

        {/* ── HISTORIAL ── */}
        {tab==='historial' && (
          <div style={s.card}>
            <div style={s.secLabel}>Historial · {trades.length} operaciones</div>
            {!trades.length && <div style={{textAlign:'center',padding:'40px 16px',color:'#2d3748',fontSize:13}}>Sin trades registrados aún.</div>}
            {trades.map(t=>(
              <div key={t.id} style={{padding:'12px 0',borderBottom:'1px solid #1a2235',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                    <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,fontFamily:'JetBrains Mono',...(parseFloat(t.pnl)>=0?{background:'rgba(74,222,128,0.15)',color:'#4ade80',border:'1px solid rgba(74,222,128,0.3)'}:{background:'rgba(248,113,113,0.15)',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)'})}}>
                      {parseFloat(t.pnl)>=0?'+':''}{t.pnl}$
                    </span>
                    <span style={{fontSize:11,fontWeight:700,color:t.direction==='long'?'#4ade80':'#f87171'}}>{t.direction==='long'?'▲ COMPRA':'▼ VENTA'}</span>
                    <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,fontFamily:'JetBrains Mono',background:'rgba(100,116,139,0.12)',color:'#94a3b8',border:'1px solid rgba(100,116,139,0.2)'}}>{t.session}</span>
                    {t.mistakes?.length>0 && <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,fontFamily:'JetBrains Mono',background:'rgba(248,113,113,0.12)',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)'}}>{t.mistakes.length} error{t.mistakes.length>1?'es':''}</span>}
                  </div>
                  <div style={{fontSize:11,color:'#64748b',fontFamily:'JetBrains Mono'}}>{t.date} · {t.emotion} · <span style={{color:t.followed_plan?'#4ade80':'#f87171'}}>{t.followed_plan?'plan ✓':'plan ✗'}</span></div>
                  {t.entry_reasons?.length>0 && <div style={{fontSize:11,color:'#4a5568',marginTop:2}}>{t.entry_reasons.join(' · ')}</div>}
                </div>
                <button onClick={()=>deleteTrade(t.id)} style={{background:'none',border:'none',color:'#2d3748',cursor:'pointer',fontSize:18,flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── SEMANA ── */}
        {tab==='semana' && (<>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
            {weekKeys.map(k=>(
              <button key={k} onClick={()=>setActiveWeek(k)} style={{background:aw===k?'rgba(99,102,241,0.08)':'#1a1f2e',border:`1px solid ${aw===k?'#6366f1':'#252d3d'}`,borderRadius:7,padding:'5px 12px',fontSize:11,cursor:'pointer',color:aw===k?'#a5b4fc':'#64748b',fontFamily:'JetBrains Mono'}}>{weekLabel(k)}</button>
            ))}
            {!weekKeys.length && <div style={{color:'#4a5568',fontSize:13}}>Sin semanas con datos aún.</div>}
          </div>
          {aw && (<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={s.card}>
                <div style={s.secLabel}>P&L semana</div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:'JetBrains Mono',color:pc(weekPnl),marginTop:4}}>{weekPnl>=0?'+':''}${weekPnl.toFixed(0)}</div>
                <div style={{fontSize:11,color:weekPnl>=300?'#4ade80':'#64748b',marginTop:4}}>{weekPnl>=300?'✓ Objetivo cumplido':`Faltan $${Math.max(0,300-weekPnl).toFixed(0)} para $300`}</div>
                <div style={s.ptrack}><div style={{height:'100%',borderRadius:4,width:`${Math.min(100,Math.max(0,Math.round((weekPnl/300)*100)))}%`,background:'linear-gradient(90deg,#22c55e,#4ade80)'}}></div></div>
              </div>
              <div style={s.card}>
                <div style={s.secLabel}>Win Rate</div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:'JetBrains Mono',color:weekWinRate>=50?'#4ade80':'#f87171',marginTop:4}}>{weekWinRate}%</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:4}}>{weekWinners.length}W · {wt.length-weekWinners.length}L · {wt.length} trades</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={s.card}>
                <div style={s.secLabel}>Mejor sesión</div>
                <div style={{fontSize:15,fontWeight:700,marginTop:4}}>{bestSession}</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:3,fontFamily:'JetBrains Mono'}}>P: {sp.principal>=0?'+':''}${sp.principal.toFixed(0)} · S: {sp.secundaria>=0?'+':''}${sp.secundaria.toFixed(0)}</div>
              </div>
              <div style={s.card}>
                <div style={s.secLabel}>Emoción dominante</div>
                <div style={{fontSize:15,fontWeight:700,marginTop:4,textTransform:'capitalize'}}>{domEmotion}</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:3}}>Siguió el plan: <span style={{color:followedPct>=70?'#4ade80':'#fbbf24',fontWeight:700}}>{followedPct}%</span></div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.secLabel}>Trades de la semana</div>
              {wt.map(t=>(
                <div key={t.id} style={{padding:'11px 0',borderBottom:'1px solid #1a2235',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:3}}>
                      <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,fontFamily:'JetBrains Mono',...(parseFloat(t.pnl)>=0?{background:'rgba(74,222,128,0.15)',color:'#4ade80',border:'1px solid rgba(74,222,128,0.3)'}:{background:'rgba(248,113,113,0.15)',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)'})}}>
                        {parseFloat(t.pnl)>=0?'+':''}{t.pnl}$
                      </span>
                      <span style={{fontSize:11,color:'#64748b'}}>{t.direction==='long'?'▲ COMPRA':'▼ VENTA'} · {t.session}</span>
                    </div>
                    <div style={{fontSize:11,color:'#4a5568',fontFamily:'JetBrains Mono'}}>{t.date} · {t.emotion}</div>
                  </div>
                  <span style={{fontSize:13,color:t.followed_plan?'#4ade80':'#f87171',fontWeight:700}}>{t.followed_plan?'✓':'✗'}</span>
                </div>
              ))}
            </div>
          </>)}
        </>)}

        {/* ── COACH IA ── */}
        {tab==='coach' && (
          <div style={s.card}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
              <div style={{width:44,height:44,borderRadius:10,background:'linear-gradient(135deg,#312e81,#4338ca)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🤖</div>
              <div>
                <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Coach IA</div>
                <div style={{fontSize:12,color:'#64748b',lineHeight:1.7}}>Análisis personalizado de tus trades. Detecta patrones, errores y qué mejorar. Funciona mejor con 10+ operaciones.</div>
              </div>
            </div>
            <button onClick={runCoach} disabled={coachLoading} style={{width:'100%',background:'linear-gradient(135deg,#6366f1,#4f46e5)',color:'#fff',border:'none',borderRadius:8,padding:'12px 18px',fontFamily:'Syne',fontSize:13,fontWeight:700,cursor:'pointer',opacity:coachLoading?0.6:1}}>
              {coachLoading?'Analizando...':`Analizar mis ${trades.length} trades`}
            </button>
            {coachText && <div style={{background:'#0a0d13',border:'1px solid #1e2535',borderRadius:10,padding:16,fontFamily:'JetBrains Mono',fontSize:12,lineHeight:1.8,color:'#cbd5e1',whiteSpace:'pre-wrap',marginTop:14}}>{coachText}</div>}
            {!coachText && !coachLoading && <div style={{textAlign:'center',padding:'40px 16px',color:'#2d3748',fontSize:13}}>Pulsa el botón para recibir tu análisis personalizado.</div>}
          </div>
        )}

        {/* ── STATS ── */}
        {tab==='stats' && (<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div style={s.card}><div style={s.secLabel}>P&L Total</div><div style={{fontSize:26,fontWeight:800,fontFamily:'JetBrains Mono',color:pc(totalPnl),marginTop:4}}>{totalPnl>=0?'+':''}${totalPnl.toFixed(0)}</div></div>
            <div style={s.card}><div style={s.secLabel}>Win Rate</div><div style={{fontSize:26,fontWeight:800,fontFamily:'JetBrains Mono',color:winRate>=50?'#4ade80':'#f87171',marginTop:4}}>{winRate}%</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
            {[['Total',trades.length,'#e2e8f0'],['Ganadores',winners.length,'#4ade80'],['Perdedores',trades.length-winners.length,'#f87171']].map(([l,v,c])=>(
              <div key={l} style={{background:'#1a1f2e',border:'1px solid #1e2535',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={s.secLabel}>{l}</div>
                <div style={{fontSize:18,fontWeight:700,fontFamily:'JetBrains Mono',color:c,marginTop:3}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{...s.card,marginBottom:10}}>
            <div style={s.secLabel}>Progreso evaluación</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6}}>
              <span style={{fontSize:12,fontFamily:'JetBrains Mono',color:'#94a3b8'}}>${totalPnl.toFixed(0)} / $1,250</span>
              <span style={{fontSize:20,fontWeight:800,color:'#4ade80',fontFamily:'JetBrains Mono'}}>{progress}%</span>
            </div>
            <div style={s.ptrack}><div style={{height:'100%',borderRadius:4,width:`${progress}%`,background:'linear-gradient(90deg,#22c55e,#4ade80)'}}></div></div>
            <div style={{fontSize:11,color:'#4a5568',marginTop:6}}>Faltan <span style={{fontFamily:'JetBrains Mono'}}>${Math.max(0,1250-totalPnl).toFixed(0)}</span> para completar la evaluación</div>
          </div>
          <div style={{...s.card,marginBottom:10}}>
            <div style={s.secLabel}>💾 Copia de seguridad</div>
            <div style={{fontSize:12,color:'#64748b',lineHeight:1.7,marginBottom:12}}>Tus datos están guardados en la base de datos. Aquí puedes exportarlos como respaldo adicional.</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button onClick={exportTrades} style={{background:'transparent',border:'1px solid #4ade80',color:'#4ade80',borderRadius:8,padding:'10px 18px',fontFamily:'Syne',fontSize:12,fontWeight:700,cursor:'pointer'}}>⬇ Exportar mis {trades.length} trades</button>
              <button onClick={()=>fileRef.current?.click()} style={{background:'transparent',border:'1px solid #6366f1',color:'#818cf8',borderRadius:8,padding:'10px 18px',fontFamily:'Syne',fontSize:12,fontWeight:700,cursor:'pointer'}}>⬆ Importar backup</button>
              <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={importTrades} />
            </div>
          </div>
          <div style={s.card}>
            <div style={s.secLabel}>Reglas de la cuenta</div>
            {RULES.map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1a2235',fontSize:12}}>
                <span style={{color:'#64748b'}}>{k}</span>
                <span style={{fontFamily:'JetBrains Mono',color:'#e2e8f0'}}>{v}</span>
              </div>
            ))}
          </div>
        </>)}

      </div>

      {toast && <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#1a1f2e',border:'1px solid #4ade80',color:'#4ade80',borderRadius:8,padding:'9px 18px',fontSize:12,fontFamily:'JetBrains Mono',zIndex:999}}>{toast}</div>}
    </div>
  )
}
