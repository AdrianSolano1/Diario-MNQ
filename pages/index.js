import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

const S = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0d13', padding:16 },
  box: { background:'#12161f', border:'1px solid #1e2535', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:420 },
  logo: { width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#3b82f6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 20px' },
  title: { fontSize:26, fontWeight:800, textAlign:'center', letterSpacing:'-0.02em', marginBottom:6 },
  sub: { fontSize:12, color:'#4a5568', textAlign:'center', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:32 },
  label: { fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'#64748b', fontWeight:700, marginBottom:6, display:'block' },
  input: { background:'#1a1f2e', color:'#e2e8f0', border:'1px solid #252d3d', borderRadius:10, padding:'13px 16px', fontFamily:'JetBrains Mono,monospace', fontSize:14, width:'100%', marginBottom:14, outline:'none' },
  btn: { width:'100%', background:'linear-gradient(135deg,#7c3aed,#6366f1,#06b6d4)', color:'#fff', border:'none', borderRadius:10, padding:16, fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:800, cursor:'pointer', letterSpacing:'0.08em', marginTop:8 },
  toggle: { textAlign:'center', marginTop:18, fontSize:13, color:'#64748b' },
  toggleBtn: { color:'#a5b4fc', cursor:'pointer', fontWeight:700, background:'none', border:'none', fontFamily:'Syne,sans-serif', fontSize:13 },
  err: { background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', color:'#f87171', borderRadius:8, padding:'10px 14px', fontSize:12, marginBottom:14, fontFamily:'JetBrains Mono,monospace' },
  ok: { background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)', color:'#4ade80', borderRadius:8, padding:'10px 14px', fontSize:12, marginBottom:14, fontFamily:'JetBrains Mono,monospace' },
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const handle = async () => {
    setError(''); setOk(''); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/diario')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setOk('Cuenta creada. Revisa tu correo para confirmarla.')
    }
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        <div style={S.logo}>📈</div>
        <div style={S.title}>MNQ DIARIO</div>
        <div style={S.sub}>Lucid 25K · Evaluación</div>
        {error && <div style={S.err}>{error}</div>}
        {ok && <div style={S.ok}>{ok}</div>}
        <label style={S.label}>Correo</label>
        <input style={S.input} type="email" placeholder="tu@correo.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} />
        <label style={S.label}>Contraseña</label>
        <input style={S.input} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} />
        <button style={S.btn} onClick={handle} disabled={loading}>
          {loading ? 'Cargando...' : mode === 'login' ? 'ENTRAR' : 'CREAR CUENTA'}
        </button>
        <div style={S.toggle}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button style={S.toggleBtn} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setOk('')}}>
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
