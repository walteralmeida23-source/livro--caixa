import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList,
  SafeAreaView, StatusBar, Platform, Image
} from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';

const SUPABASE_URL  = 'https://fpawttewuxrdptjrmdjt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYXd0dGV3dXhyZHB0anJtZGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NjA2NTQsImV4cCI6MjA5NDUzNjY1NH0.FXVDAYmSpZxU9EVioEUiUtKO5QU-2T82WxbjV6Dj28A';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const C = { bg:'#F5F1E8', dark:'#2A2620', green:'#3D5A3D', red:'#A8492C', gold:'#B8956A', white:'#FFFFFF', gray:'#8C8880' };

const INCOME_CATS  = ['Vendas','Prestação de Serviços','Subsídios','Juros recebidos','Outros rendimentos'];
const EXPENSE_CATS = ['Renda','Eletricidade','Água','Gás','Comunicações','Internet','Combustível','Material de escritório','Equipamento','Software/Subscrições','Formação','Honorários','Marketing','Deslocações','Refeições','Seguros','Manutenção','Despesas bancárias','Salários','Segurança Social','Impostos','Outros'];
const VAT_RATES    = [0, 6, 13, 23];
const MESES        = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const eur   = v => new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' }).format(Number(v)||0);
const dtPT  = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-PT') : '';
const today = () => new Date().toISOString().split('T')[0];
const mKey  = d => (d||'').substring(0,7);
const yKey  = d => (d||'').substring(0,4);

// ── LOGIN ────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [mode, setMode]       = useState('login');
  const [nome, setNome]       = useState('');
  const [empresa, setEmpresa] = useState('');
  const [busy, setBusy]       = useState(false);

  const go = async () => {
    if (!email || !pw) { Alert.alert('Erro','Preencha email e password.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        const { data: p } = await supabase.from('perfis').select('*').eq('id', data.user.id).single();
        onLogin(data.user, p || null);
      } else {
        if (!nome || !empresa) { Alert.alert('Erro','Preencha nome e empresa.'); setBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        const { data: emp } = await supabase.from('empresas').insert([{ nome: empresa }]).select().single();
        await supabase.from('perfis').insert([{ id: data.user.id, nome, role:'admin', empresa_id: emp.id }]);
        Alert.alert('Conta criada!', 'Confirme o email e entre.');
        setMode('login');
      }
    } catch (e) {
      Alert.alert('Erro', e.message === 'Invalid login credentials' ? 'Email ou password incorretos.' : e.message);
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
      <ScrollView contentContainerStyle={s.authContainer}>
        <Text style={s.authTitle}>Livro de Caixa</Text>
        <Text style={s.authSub}>Gestão financeira empresarial</Text>
        <View style={s.toggleRow}>
          {['login','register'].map(m => (
            <TouchableOpacity key={m} style={[s.toggleBtn, mode===m && s.toggleActive]} onPress={()=>setMode(m)}>
              <Text style={[s.toggleTxt, mode===m && s.toggleActiveTxt]}>{m==='login'?'Entrar':'Criar conta'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {mode==='register' && <>
          <Text style={s.lbl}>Nome completo</Text>
          <TextInput style={s.inp} value={nome} onChangeText={setNome} placeholder="João Silva"/>
          <Text style={s.lbl}>Nome da empresa</Text>
          <TextInput style={s.inp} value={empresa} onChangeText={setEmpresa} placeholder="Empresa Lda."/>
        </>}
        <Text style={s.lbl}>Email</Text>
        <TextInput style={s.inp} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@empresa.pt"/>
        <Text style={s.lbl}>Password</Text>
        <TextInput style={s.inp} value={pw} onChangeText={setPw} secureTextEntry placeholder="Mínimo 6 caracteres"/>
        <TouchableOpacity style={[s.btn, s.btnDark]} onPress={go} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnDarkTxt}>{mode==='login'?'Entrar':'Criar conta'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── APP ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null); setPerfil(null);
  };

  const criarAdmin = async (uid, email) => {
    try {
      const { data: emp, error: e1 } = await supabase.from('empresas').insert([{ nome:'Minha Empresa' }]).select().single();
      if (e1) { Alert.alert('Erro', e1.message); return; }
      const { data: p, error: e2 } = await supabase.from('perfis').insert([{ id:uid, nome:email, role:'admin', empresa_id:emp.id }]).select().single();
      if (e2) { Alert.alert('Erro', e2.message); return; }
      setPerfil(p);
    } catch(e) { Alert.alert('Erro', e.message); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        const { data: p } = await supabase.from('perfis').select('*').eq('id', session.user.id).single();
        setPerfil(p || null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:C.bg }}>
      <ActivityIndicator size="large" color={C.dark}/>
    </View>
  );

  if (!user) return <LoginScreen onLogin={(u,p)=>{ setUser(u); setPerfil(p); }}/>;

  if (!perfil) return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:24, gap:16 }}>
        <Text style={s.authTitle}>Completar registo</Text>
        <Text style={{ color:C.gray, textAlign:'center', fontSize:14, lineHeight:22 }}>
          Clique abaixo para criar o seu perfil como Administrador.
        </Text>
        <TouchableOpacity style={[s.btn, s.btnDark]} onPress={()=>criarAdmin(user.id, user.email)}>
          <Text style={s.btnDarkTxt}>Criar como Administrador</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={logout}>
          <Text style={s.btnTxt}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
      {perfil.role==='admin'      && <AdminScreen      perfil={perfil} onLogout={logout}/>}
      {perfil.role==='employee'   && <EmployeeScreen   perfil={perfil} onLogout={logout}/>}
      {perfil.role==='accountant' && <AccountantScreen perfil={perfil} onLogout={logout}/>}
    </SafeAreaView>
  );
}

// ── HEADER ───────────────────────────────────────────────
function Header({ title, subtitle, onLogout }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={onLogout} style={s.logoutBtn}>
        <Text style={s.logoutTxt}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

function RoleBadge({ label, color }) {
  return (
    <View style={[s.roleBadge, { backgroundColor:color+'18' }]}>
      <Text style={[s.roleBadgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

function TabBar({ tabs, active, onPress }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal:12 }}>
      {tabs.map(t => (
        <TouchableOpacity key={t.id} style={[s.tab, active===t.id && s.tabActive]} onPress={()=>onPress(t.id)}>
          <Text style={[s.tabTxt, active===t.id && s.tabActiveTxt]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Loader() {
  return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator size="large" color={C.dark}/></View>;
}

function SummaryBar({ txs }) {
  const income  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  return (
    <View style={s.summaryBar}>
      <View style={s.summaryItem}>
        <Text style={s.summaryLbl}>Receitas</Text>
        <Text style={[s.summaryVal, { color:C.green }]}>{eur(income)}</Text>
      </View>
      <View style={s.summaryDivider}/>
      <View style={s.summaryItem}>
        <Text style={s.summaryLbl}>Despesas</Text>
        <Text style={[s.summaryVal, { color:C.red }]}>{eur(expense)}</Text>
      </View>
      <View style={s.summaryDivider}/>
      <View style={s.summaryItem}>
        <Text style={s.summaryLbl}>Saldo</Text>
        <Text style={[s.summaryVal, { color:income-expense>=0?C.green:C.red }]}>{eur(income-expense)}</Text>
      </View>
    </View>
  );
}

function StatusPill({ status }) {
  const cfg = {
    pendente:  { bg:C.gold+'25',  txt:C.gold },
    aprovado:  { bg:C.green+'25', txt:C.green },
    rejeitado: { bg:C.red+'25',   txt:C.red },
  };
  const c = cfg[status] || cfg.pendente;
  return (
    <View style={[s.pill, { backgroundColor:c.bg, marginTop:4 }]}>
      <Text style={[s.pillTxt, { color:c.txt }]}>{status}</Text>
    </View>
  );
}

function StatCard({ label, value, dark, accent, fullWidth }) {
  return (
    <View style={[s.statCard, dark&&{ backgroundColor:C.dark }, fullWidth&&{ flex:1 }]}>
      <Text style={[s.statLabel, dark&&{ color:'#ffffff99' }]}>{label}</Text>
      <Text style={[s.statValue, dark&&{ color:'#fff' }, accent&&{ color:accent }]}>{value}</Text>
    </View>
  );
}

// ── ADMIN ────────────────────────────────────────────────
function AdminScreen({ perfil, onLogout }) {
  const [tab, setTab]           = useState('dashboard');
  const [txs, setTxs]           = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx]     = useState(null);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data:t, error:e1 } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending:false });

    const { data:u, error:e2 } = await supabase
      .from('perfis')
      .select('*')
      .eq('empresa_id', perfil.empresa_id);

    if (e1) Alert.alert('Erro transações', e1.message);
    if (e2) Alert.alert('Erro perfis', e2.message);

    // Juntar o nome do utilizador manualmente
    const perfilMap = {};
    (u||[]).forEach(p => { perfilMap[p.id] = p; });
    const txComNome = (t||[]).map(tx => ({
      ...tx,
      perfis: perfilMap[tx.user_id] ? { nome: perfilMap[tx.user_id].nome } : null
    }));

    setTxs(txComNome);
    setUsers(u || []);
    setLoading(false);
    setRefreshing(false);
  }, [perfil.empresa_id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const approve = async (id, status) => {
    const { error } = await supabase.from('transactions').update({ status }).eq('id', id);
    if (error) { Alert.alert('Erro', error.message); return; }
    setTxs(p => p.map(t => t.id===id ? {...t, status} : t));
  };

  const removeTx = (id) => {
    Alert.alert('Eliminar','Tem a certeza?',[
      { text:'Cancelar', style:'cancel' },
      { text:'Eliminar', style:'destructive', onPress: async () => {
        await supabase.from('transactions').delete().eq('id', id);
        setTxs(p => p.filter(t => t.id!==id));
      }},
    ]);
  };

  const TABS = [
    { id:'dashboard',  label:'Painel' },
    { id:'txs',        label:'Lançamentos' },
    { id:'users',      label:'Utilizadores' },
    { id:'relatorios', label:'Relatórios' },
  ];

  return (
    <View style={{ flex:1 }}>
      <Header title="Admin" subtitle={perfil.nome} onLogout={onLogout}/>
      <RoleBadge label="Administrador" color={C.dark}/>
      {/* Botão atualizar sempre visível */}
      <TouchableOpacity
        onPress={()=>loadAll(true)}
        style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:7, gap:6, backgroundColor:refreshing?C.gold+'20':C.green+'15', borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.08)' }}>
        <Text style={{ fontSize:13, color: refreshing?C.gold:C.green, fontWeight:'600' }}>
          {refreshing ? '⏳ A atualizar...' : '↻  Atualizar dados'}
        </Text>
      </TouchableOpacity>
      <TabBar tabs={TABS} active={tab} onPress={setTab}/>
      {loading ? <Loader/> : <>
        {tab==='dashboard'  && <AdminDashboard txs={txs} users={users} onNewTx={()=>{ setEditTx(null); setShowForm(true); }}/>}
        {tab==='txs'        && <>
          <SummaryBar txs={txs}/>
          <TxList txs={txs} isAdmin
            onApprove={approve} onDelete={removeTx}
            onEdit={t=>{ setEditTx(t); setShowForm(true); }}/>
        </>}
        {tab==='users'      && <UsersPanel users={users} perfil={perfil} onRefresh={loadAll}/>}
        {tab==='relatorios' && <RelatoriosPanel txs={txs}/>}
      </>}
      <TouchableOpacity style={s.fab} onPress={()=>{ setEditTx(null); setShowForm(true); }}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>
      {showForm && <TxForm perfil={perfil} editing={editTx}
        onSave={async ()=>{ await loadAll(); setShowForm(false); setEditTx(null); }}
        onClose={()=>{ setShowForm(false); setEditTx(null); }}/>}
    </View>
  );
}

// ── FUNCIONÁRIO ──────────────────────────────────────────
function EmployeeScreen({ perfil, onLogout }) {
  const [tab, setTab]           = useState('today');
  const [txs, setTxs]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx]     = useState(null);

  const loadTxs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('transactions').select('*')
      .eq('user_id', perfil.id).order('date', { ascending:false }).order('criado_em', { ascending:false });
    if (error) Alert.alert('Erro ao carregar', error.message);
    setTxs(data || []);
    setLoading(false);
  }, [perfil.id]);

  useEffect(() => { loadTxs(); }, [loadTxs]);

  const td = today();
  const listData = tab==='today' ? txs.filter(t=>t.date===td)
    : tab==='month' ? txs.filter(t=>mKey(t.date)===mKey(td))
    : txs;

  const TABS = [{ id:'today', label:'Hoje' },{ id:'month', label:'Este mês' },{ id:'all', label:'Todos' }];

  return (
    <View style={{ flex:1 }}>
      <Header title="Funcionário" subtitle={perfil.nome} onLogout={onLogout}/>
      <RoleBadge label="Funcionário" color={C.green}/>
      <SummaryBar txs={listData}/>
      <TabBar tabs={TABS} active={tab} onPress={setTab}/>
      {loading ? <Loader/> :
        <TxList txs={listData} isAdmin={false}
          onEdit={t=>{
            if (t.status==='aprovado'){ Alert.alert('Aviso','Lançamento aprovado não pode ser editado.'); return; }
            setEditTx(t); setShowForm(true);
          }}/>}
      <TouchableOpacity style={s.fab} onPress={()=>{ setEditTx(null); setShowForm(true); }}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>
      {showForm && <TxForm perfil={perfil} editing={editTx}
        onSave={async ()=>{ await loadTxs(); setShowForm(false); setEditTx(null); }}
        onClose={()=>{ setShowForm(false); setEditTx(null); }}/>}
    </View>
  );
}

// ── CONTABILISTA ─────────────────────────────────────────
function AccountantScreen({ perfil, onLogout }) {
  const [tab, setTab]         = useState('txs');
  const [txs, setTxs]         = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const empresaId = perfil.empresa_id;
    (async () => {
      const { data:t, error:e1 } = await supabase
        .from('transactions').select('*')
        .order('date', { ascending:false });

      const { data:u } = await supabase
        .from('perfis').select('*')
        .eq('empresa_id', empresaId);

      if (e1) Alert.alert('Erro', e1.message);

      const perfilMap = {};
      (u||[]).forEach(p => { perfilMap[p.id] = p; });
      const txComNome = (t||[]).map(tx => ({
        ...tx,
        perfis: perfilMap[tx.user_id] ? { nome: perfilMap[tx.user_id].nome } : null
      }));

      setTxs(txComNome);
      setLoading(false);
    })();
  }, [perfil.empresa_id]);

  const TABS = [{ id:'txs', label:'Lançamentos' },{ id:'relatorios', label:'Relatórios' }];

  return (
    <View style={{ flex:1 }}>
      <Header title="Contabilista" subtitle={perfil.nome} onLogout={onLogout}/>
      <RoleBadge label="Só leitura" color={C.gold}/>
      <SummaryBar txs={txs}/>
      <TabBar tabs={TABS} active={tab} onPress={setTab}/>
      {loading ? <Loader/> : <>
        {tab==='txs'        && <TxList txs={txs} isAdmin={false} showUser/>}
        {tab==='relatorios' && <RelatoriosPanel txs={txs}/>}
      </>}
    </View>
  );
}

// ── DASHBOARD ADMIN ──────────────────────────────────────
function AdminDashboard({ txs, users, onNewTx }) {
  const td = today();
  const pendentes = txs.filter(t=>t.status==='pendente');

  const calcTotais = (filtro) => {
    const items = txs.filter(filtro);
    return {
      income:  items.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),
      expense: items.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0),
    };
  };

  const hoje = calcTotais(t => t.date === td);
  const mes  = calcTotais(t => mKey(t.date) === mKey(td));
  const ano  = calcTotais(t => yKey(t.date) === yKey(td));

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>

      {/* Cartões de resumo */}
      <Text style={[s.cardTitle, { marginBottom:0 }]}>Hoje</Text>
      <View style={{ flexDirection:'row', gap:12 }}>
        <StatCard label="Receitas"  value={eur(hoje.income)}           accent={C.green}/>
        <StatCard label="Despesas"  value={eur(hoje.expense)}          accent={C.red}/>
        <StatCard label="Saldo"     value={eur(hoje.income-hoje.expense)} dark/>
      </View>

      <Text style={[s.cardTitle, { marginBottom:0 }]}>Este mês</Text>
      <View style={{ flexDirection:'row', gap:12 }}>
        <StatCard label="Receitas"  value={eur(mes.income)}            accent={C.green}/>
        <StatCard label="Despesas"  value={eur(mes.expense)}           accent={C.red}/>
        <StatCard label="Saldo"     value={eur(mes.income-mes.expense)} dark/>
      </View>

      <Text style={[s.cardTitle, { marginBottom:0 }]}>Este ano</Text>
      <View style={{ flexDirection:'row', gap:12 }}>
        <StatCard label="Receitas"  value={eur(ano.income)}            accent={C.green}/>
        <StatCard label="Despesas"  value={eur(ano.expense)}           accent={C.red}/>
        <StatCard label="Saldo"     value={eur(ano.income-ano.expense)} dark/>
      </View>

      {/* Estatísticas gerais */}
      <View style={{ flexDirection:'row', gap:12 }}>
        <StatCard label="Utilizadores"  value={String(users.length)}/>
        <StatCard label="Pendentes"     value={String(pendentes.length)} accent={pendentes.length>0?C.red:C.green}/>
        <StatCard label="Total lanç."   value={String(txs.length)}/>
      </View>

      {/* Pendentes */}
      {pendentes.length>0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>⏳ A aguardar aprovação</Text>
          {pendentes.slice(0,5).map(t=>(
            <View key={t.id} style={s.txRow}>
              <View style={{ flex:1 }}>
                <Text style={s.txDesc}>{t.description||t.category}</Text>
                <Text style={s.txMeta}>{dtPT(t.date)} · {t.perfis?.nome||'—'}</Text>
              </View>
              <Text style={[s.txAmt,{ color:t.type==='income'?C.green:C.red }]}>
                {t.type==='income'?'+':'−'}{eur(t.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recentes */}
      <View style={s.card}>
        <Text style={s.cardTitle}>🕐 Lançamentos recentes</Text>
        {txs.length===0
          ? <Text style={[s.emptyTxt, { textAlign:'left', fontStyle:'normal', color:C.red }]}>
              ⚠️ Nenhum lançamento carregado. Toque em "Atualizar" acima.
            </Text>
          : txs.slice(0,8).map(t=>(
            <View key={t.id} style={s.txRow}>
              <View style={[s.txDot,{ backgroundColor:t.type==='income'?C.green:C.red, marginRight:8 }]}/>
              <View style={{ flex:1 }}>
                <Text style={s.txDesc}>{t.description||t.category}</Text>
                <Text style={s.txMeta}>{dtPT(t.date)} · {t.perfis?.nome||'—'}</Text>
              </View>
              <Text style={[s.txAmt,{ color:t.type==='income'?C.green:C.red }]}>
                {t.type==='income'?'+':'−'}{eur(t.amount)}
              </Text>
            </View>
          ))
        }
      </View>

      <TouchableOpacity style={[s.btn, s.btnDark]} onPress={onNewTx}>
        <Text style={s.btnDarkTxt}>+ Novo Lançamento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── LISTA DE TRANSAÇÕES ──────────────────────────────────
function TxList({ txs, isAdmin, showUser, onApprove, onDelete, onEdit }) {
  const [imgModal, setImgModal] = useState(null);

  if (txs.length===0) return (
    <View style={s.empty}><Text style={s.emptyTxt}>Nenhum lançamento encontrado.</Text></View>
  );

  return (
    <>
      <FlatList data={txs} keyExtractor={t=>t.id} contentContainerStyle={{ padding:16, paddingBottom:100 }}
        renderItem={({ item:t }) => (
          <View style={s.txCard}>
            <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
              <View style={[s.txDot, { backgroundColor:t.type==='income'?C.green:C.red }]}/>
              <View style={{ flex:1 }}>
                <Text style={s.txDesc}>{t.description||t.category}</Text>
                <Text style={s.txMeta}>{dtPT(t.date)} · {t.category}</Text>
                {showUser && t.perfis?.nome && <Text style={s.txMeta}>Por: {t.perfis.nome}</Text>}
                <Text style={s.txMeta}>IVA: {t.vat||23}%{t.invoice_number ? ` · ${t.invoice_number}` : ''}</Text>
                <StatusPill status={t.status}/>
              </View>
              <Text style={[s.txAmt, { color:t.type==='income'?C.green:C.red }]}>
                {t.type==='income'?'+':'−'}{eur(t.amount)}
              </Text>
            </View>
            {t.img_uri && (
              <TouchableOpacity onPress={()=>setImgModal(t.img_uri)} style={{ marginTop:10 }}>
                <Image source={{ uri:t.img_uri }} style={s.txThumb} resizeMode="cover"/>
                <Text style={[s.txMeta, { marginTop:4 }]}>📄 Toque para ver fatura</Text>
              </TouchableOpacity>
            )}
            {(isAdmin || onEdit) && (
              <View style={s.txActions}>
                {isAdmin && t.status==='pendente' && <>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor:C.green }]} onPress={()=>onApprove(t.id,'aprovado')}>
                    <Text style={s.actBtnTxt}>✓ Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actBtn, { backgroundColor:C.red }]} onPress={()=>onApprove(t.id,'rejeitado')}>
                    <Text style={s.actBtnTxt}>✕ Rejeitar</Text>
                  </TouchableOpacity>
                </>}
                {onEdit && <TouchableOpacity style={[s.actBtn, { backgroundColor:C.gold }]} onPress={()=>onEdit(t)}>
                  <Text style={s.actBtnTxt}>Editar</Text>
                </TouchableOpacity>}
                {isAdmin && onDelete && <TouchableOpacity style={[s.actBtn, { backgroundColor:'#888' }]} onPress={()=>onDelete(t.id)}>
                  <Text style={s.actBtnTxt}>Eliminar</Text>
                </TouchableOpacity>}
              </View>
            )}
          </View>
        )}/>
      {imgModal && (
        <Modal visible transparent animationType="fade" onRequestClose={()=>setImgModal(null)}>
          <TouchableOpacity style={s.imgOverlay} onPress={()=>setImgModal(null)} activeOpacity={1}>
            <Image source={{ uri:imgModal }} style={s.imgFull} resizeMode="contain"/>
            <Text style={{ color:'#fff', marginTop:12, fontSize:13 }}>Toque para fechar</Text>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

// ── FORMULÁRIO ───────────────────────────────────────────
function TxForm({ perfil, editing, onSave, onClose }) {
  const [type, setType]     = useState(editing?.type||'expense');
  const [date, setDate]     = useState(editing?.date||today());
  const [cat, setCat]       = useState(editing?.category||(editing?.type==='income'?INCOME_CATS[0]:EXPENSE_CATS[0]));
  const [desc, setDesc]     = useState(editing?.description||'');
  const [amount, setAmount] = useState(editing?.amount?.toString()||'');
  const [vat, setVat]       = useState(editing?.vat||23);
  const [invNum, setInvNum] = useState(editing?.invoice_number||'');
  const [imgUri, setImgUri] = useState(editing?.img_uri||null);
  const [showScan, setShowScan]   = useState(false);
  const [showCats, setShowCats]   = useState(false);
  const [showVat, setShowVat]     = useState(false);
  const [busy, setBusy]           = useState(false);

  const cats = type==='income' ? INCOME_CATS : EXPENSE_CATS;

  const pickImage = async (fromCamera) => {
    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permissão negada','Active o acesso à câmara nas definições.'); return; }
        result = await ImagePicker.launchCameraAsync({ quality:0.7, allowsEditing:true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permissão negada','Active o acesso à galeria nas definições.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ quality:0.7, allowsEditing:true });
      }
      if (!result.canceled && result.assets?.[0]) {
        setImgUri(result.assets[0].uri);
        setShowScan(false);
      }
    } catch(e) { Alert.alert('Erro', e.message); }
  };

  const save = async () => {
    // Aceita vírgula ou ponto como separador decimal
    const amountNum = Number(amount.toString().replace(',', '.'));
    if (!amount || isNaN(amountNum) || amountNum <= 0) { Alert.alert('Erro','Indique um valor válido.'); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Erro','Data inválida. Use o formato AAAA-MM-DD.'); return; }
    setBusy(true);
    try {
      const payload = {
        user_id:       perfil.id,
        empresa_id:    perfil.empresa_id,
        date,
        type,
        category:      cat,
        description:   desc,
        amount:        amountNum,
        vat:           Number(vat),
        invoice_number: invNum,
        img_uri:       imgUri || null,
        status:        perfil.role==='admin' ? 'aprovado' : 'pendente',
      };
      let error;
      if (editing) {
        ({ error } = await supabase.from('transactions').update(payload).eq('id', editing.id));
      } else {
        ({ error } = await supabase.from('transactions').insert([payload]));
      }
      if (error) { Alert.alert('Erro ao guardar', error.message); setBusy(false); return; }
      onSave();
    } catch(e) { Alert.alert('Erro', e.message); }
    setBusy(false);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{editing?'Editar':'Novo'} Lançamento</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize:22, color:C.dark }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding:16, gap:14, paddingBottom:40 }}>

          {/* Tipo */}
          <View style={s.toggleRow}>
            <TouchableOpacity style={[s.toggleBtn, type==='income'&&{ backgroundColor:C.green }]}
              onPress={()=>{ setType('income'); setCat(INCOME_CATS[0]); }}>
              <Text style={[s.toggleTxt, type==='income'&&{ color:'#fff' }]}>📈 Receita</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggleBtn, type==='expense'&&{ backgroundColor:C.red }]}
              onPress={()=>{ setType('expense'); setCat(EXPENSE_CATS[0]); }}>
              <Text style={[s.toggleTxt, type==='expense'&&{ color:'#fff' }]}>📉 Despesa</Text>
            </TouchableOpacity>
          </View>

          <View><Text style={s.lbl}>Data (AAAA-MM-DD)</Text>
            <TextInput style={s.inp} value={date} onChangeText={setDate} placeholder={today()} keyboardType="numeric"/>
          </View>

          <View><Text style={s.lbl}>Categoria</Text>
            <TouchableOpacity style={[s.inp, s.inpRow]} onPress={()=>setShowCats(true)}>
              <Text style={{ color:C.dark, flex:1 }}>{cat}</Text>
              <Text style={{ color:C.gray }}>▾</Text>
            </TouchableOpacity>
          </View>

          <View><Text style={s.lbl}>Descrição</Text>
            <TextInput style={s.inp} value={desc} onChangeText={setDesc} placeholder="Ex: Compra material escritório"/>
          </View>

          <View style={{ flexDirection:'row', gap:12 }}>
            <View style={{ flex:2 }}><Text style={s.lbl}>Valor (€)</Text>
              <TextInput style={s.inp} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00"/>
            </View>
            <View style={{ flex:1 }}><Text style={s.lbl}>IVA</Text>
              <TouchableOpacity style={[s.inp, s.inpRow]} onPress={()=>setShowVat(true)}>
                <Text style={{ color:C.dark }}>{vat}%</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View><Text style={s.lbl}>Nº Fatura (opcional)</Text>
            <TextInput style={s.inp} value={invNum} onChangeText={setInvNum} placeholder="FT 2026/001"/>
          </View>

          {/* Fatura */}
          <View>
            <Text style={s.lbl}>Fatura / Recibo</Text>
            {imgUri ? (
              <View>
                <Image source={{ uri:imgUri }} style={s.faturaPreview} resizeMode="contain"/>
                <TouchableOpacity style={[s.btn, { marginTop:8 }]} onPress={()=>setImgUri(null)}>
                  <Text style={s.btnTxt}>🗑 Remover imagem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.btn, s.inpRow, { paddingHorizontal:16 }]} onPress={()=>setShowScan(true)}>
                <Text style={{ fontSize:20 }}>📷</Text>
                <View style={{ marginLeft:10 }}>
                  <Text style={s.btnTxt}>Fotografar / Galeria</Text>
                  <Text style={{ fontSize:12, color:C.gray }}>Anexar imagem da fatura</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {perfil.role==='employee' && (
            <View style={[s.card, { backgroundColor:C.gold+'15', borderColor:C.gold+'40' }]}>
              <Text style={{ fontSize:13, color:C.dark }}>⏳ Ficará <Text style={{ fontWeight:'700' }}>pendente</Text> até aprovação do administrador.</Text>
            </View>
          )}

          <TouchableOpacity style={[s.btn, s.btnDark, { marginTop:4 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnDarkTxt}>{editing?'Atualizar':'Guardar lançamento'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={onClose}>
            <Text style={s.btnTxt}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Scanner modal */}
        <Modal visible={showScan} animationType="slide" onRequestClose={()=>setShowScan(false)}>
          <SafeAreaView style={{ flex:1, backgroundColor:'#111' }}>
            <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
              <Text style={{ color:'#fff', fontSize:22, fontWeight:'700' }}>📄 Anexar Fatura</Text>
              <TouchableOpacity style={[s.scanBtn, { backgroundColor:C.green }]} onPress={()=>pickImage(true)}>
                <Text style={{ fontSize:32 }}>📷</Text>
                <Text style={s.scanBtnTxt}>Fotografar agora</Text>
                <Text style={s.scanBtnSub}>Abre a câmara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.scanBtn, { backgroundColor:C.dark }]} onPress={()=>pickImage(false)}>
                <Text style={{ fontSize:32 }}>🖼️</Text>
                <Text style={s.scanBtnTxt}>Escolher da galeria</Text>
                <Text style={s.scanBtnSub}>Fotos já tiradas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { borderColor:'#ffffff40', width:'100%' }]} onPress={()=>setShowScan(false)}>
                <Text style={{ color:'#fff', fontWeight:'600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Picker categorias */}
        <Modal visible={showCats} transparent animationType="slide">
          <View style={s.pickerOverlay}>
            <View style={s.pickerBox}>
              <Text style={[s.cardTitle, { margin:16 }]}>Selecionar categoria</Text>
              <ScrollView>
                {cats.map(c => (
                  <TouchableOpacity key={c} style={s.pickerItem} onPress={()=>{ setCat(c); setShowCats(false); }}>
                    <Text style={[s.pickerItemTxt, c===cat&&{ color:C.green, fontWeight:'700' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={[s.btn, s.btnDark, { margin:16 }]} onPress={()=>setShowCats(false)}>
                <Text style={s.btnDarkTxt}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Picker IVA */}
        <Modal visible={showVat} transparent animationType="slide">
          <View style={s.pickerOverlay}>
            <View style={[s.pickerBox, { maxHeight:300 }]}>
              <Text style={[s.cardTitle, { margin:16 }]}>Taxa de IVA</Text>
              {VAT_RATES.map(r => (
                <TouchableOpacity key={r} style={s.pickerItem} onPress={()=>{ setVat(r); setShowVat(false); }}>
                  <Text style={[s.pickerItemTxt, r===vat&&{ color:C.green, fontWeight:'700' }]}>{r}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.btn, s.btnDark, { margin:16 }]} onPress={()=>setShowVat(false)}>
                <Text style={s.btnDarkTxt}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ── UTILIZADORES ─────────────────────────────────────────
function UsersPanel({ users, perfil, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail]     = useState('');
  const [nome, setNome]       = useState('');
  const [role, setRole]       = useState('employee');
  const [pw, setPw]           = useState('');
  const [busy, setBusy]       = useState(false);

  const ROLES = { admin:'Administrador', employee:'Funcionário', accountant:'Contabilista' };
  const ROLE_COLORS = { admin:C.dark, employee:C.green, accountant:C.gold };

  const addUser = async () => {
    if (!email||!nome||!pw) { Alert.alert('Erro','Preencha todos os campos.'); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password:pw });
    if (error) { Alert.alert('Erro', error.message); setBusy(false); return; }
    const { error: e2 } = await supabase.from('perfis').insert([{ id:data.user.id, nome, role, empresa_id:perfil.empresa_id }]);
    if (e2) { Alert.alert('Erro perfil', e2.message); setBusy(false); return; }
    Alert.alert('Sucesso', `${nome} adicionado! Deve confirmar o email para entrar.`);
    setShowAdd(false); setEmail(''); setNome(''); setPw(''); setRole('employee');
    onRefresh();
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12, paddingBottom:100 }}>
      <TouchableOpacity style={[s.btn, s.btnDark]} onPress={()=>setShowAdd(true)}>
        <Text style={s.btnDarkTxt}>+ Adicionar utilizador</Text>
      </TouchableOpacity>
      {users.map(u => (
        <View key={u.id} style={s.card}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            <View style={[s.avatar, { backgroundColor:ROLE_COLORS[u.role]+'30' }]}>
              <Text style={[s.avatarTxt, { color:ROLE_COLORS[u.role] }]}>{(u.nome||'?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.txDesc}>{u.nome}</Text>
              <View style={{ flexDirection:'row', gap:6, marginTop:4, flexWrap:'wrap' }}>
                <View style={[s.pill, { backgroundColor:ROLE_COLORS[u.role]+'20' }]}>
                  <Text style={[s.pillTxt, { color:ROLE_COLORS[u.role] }]}>{ROLES[u.role]}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ))}

      <Modal visible={showAdd} animationType="slide" onRequestClose={()=>setShowAdd(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Novo utilizador</Text>
            <TouchableOpacity onPress={()=>setShowAdd(false)}><Text style={{ fontSize:22 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding:16, gap:14 }}>
            <Text style={s.lbl}>Nome</Text>
            <TextInput style={s.inp} value={nome} onChangeText={setNome} placeholder="Nome completo"/>
            <Text style={s.lbl}>Email</Text>
            <TextInput style={s.inp} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@empresa.pt"/>
            <Text style={s.lbl}>Password inicial</Text>
            <TextInput style={s.inp} value={pw} onChangeText={setPw} secureTextEntry placeholder="Mínimo 6 caracteres"/>
            <Text style={s.lbl}>Nível de acesso</Text>
            {['employee','accountant','admin'].map(r => (
              <TouchableOpacity key={r} style={[s.roleBtn, role===r&&{ borderColor:ROLE_COLORS[r], backgroundColor:ROLE_COLORS[r]+'15' }]} onPress={()=>setRole(r)}>
                <Text style={[s.roleBtnTxt, role===r&&{ color:ROLE_COLORS[r], fontWeight:'700' }]}>{ROLES[r]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.btn, s.btnDark, { marginTop:8 }]} onPress={addUser} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnDarkTxt}>Criar utilizador</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

// ── RELATÓRIOS ───────────────────────────────────────────
function RelatoriosPanel({ txs }) {
  const yr   = yKey(today());
  const ytxs = txs.filter(t=>yKey(t.date)===yr);
  const byMonth = Array.from({ length:12 }, (_,i) => {
    const k  = `${yr}-${String(i+1).padStart(2,'0')}`;
    const it = ytxs.filter(t=>mKey(t.date)===k);
    const income  = it.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const expense = it.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    return { mes:MESES[i], income, expense, net:income-expense, n:it.length };
  });
  const tot = byMonth.reduce((a,m)=>({ income:a.income+m.income, expense:a.expense+m.expense }),{ income:0, expense:0 });

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12, paddingBottom:100 }}>
      <View style={{ flexDirection:'row', gap:12 }}>
        <StatCard label="Receitas" value={eur(tot.income)} accent={C.green}/>
        <StatCard label="Despesas" value={eur(tot.expense)} accent={C.red}/>
      </View>
      <StatCard label={`Resultado ${yr}`} value={eur(tot.income-tot.expense)} dark fullWidth/>
      <View style={s.card}>
        <Text style={s.cardTitle}>Resumo mensal · {yr}</Text>
        <View style={{ flexDirection:'row', paddingBottom:8, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.1)' }}>
          <Text style={[s.txMeta, { width:36, fontWeight:'700' }]}>Mês</Text>
          <Text style={[s.txMeta, { flex:1, textAlign:'center', fontWeight:'700', color:C.green }]}>Rec.</Text>
          <Text style={[s.txMeta, { flex:1, textAlign:'center', fontWeight:'700', color:C.red }]}>Desp.</Text>
          <Text style={[s.txMeta, { flex:1, textAlign:'right', fontWeight:'700' }]}>Saldo</Text>
        </View>
        {byMonth.map((m,i) => (
          <View key={i} style={[s.txRow, { opacity:m.n===0?.35:1 }]}>
            <Text style={[s.txMeta, { width:36 }]}>{m.mes}</Text>
            <Text style={[s.txMeta, { flex:1, textAlign:'center', color:C.green }]}>{eur(m.income)}</Text>
            <Text style={[s.txMeta, { flex:1, textAlign:'center', color:C.red }]}>{eur(m.expense)}</Text>
            <Text style={[s.txMeta, { flex:1, textAlign:'right', fontWeight:'600', color:m.net>=0?C.green:C.red }]}>{eur(m.net)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── ESTILOS ──────────────────────────────────────────────
const s = StyleSheet.create({
  authContainer:   { flexGrow:1, justifyContent:'center', padding:24, gap:14 },
  authTitle:       { fontFamily:Platform.OS==='ios'?'Georgia':'serif', fontSize:32, fontWeight:'600', color:C.dark, textAlign:'center' },
  authSub:         { fontSize:14, color:C.gray, textAlign:'center', marginTop:-8 },
  header:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.15)' },
  headerTitle:     { fontSize:20, fontWeight:'700', color:C.dark },
  headerSub:       { fontSize:13, color:C.gray, marginTop:1 },
  logoutBtn:       { paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:0.5, borderColor:C.dark+'30' },
  logoutTxt:       { fontSize:13, color:C.gray },
  roleBadge:       { marginHorizontal:16, marginVertical:6, paddingHorizontal:12, paddingVertical:5, borderRadius:8, alignSelf:'flex-start' },
  roleBadgeTxt:    { fontSize:12, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5 },
  tabBar:          { borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.1)', maxHeight:46 },
  tab:             { paddingHorizontal:14, paddingVertical:12, borderBottomWidth:2, borderColor:'transparent', marginRight:2 },
  tabActive:       { borderColor:C.red },
  tabTxt:          { fontSize:13, color:C.gray, fontWeight:'500' },
  tabActiveTxt:    { color:C.red, fontWeight:'600' },
  summaryBar:      { flexDirection:'row', backgroundColor:C.white, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.08)' },
  summaryItem:     { flex:1, alignItems:'center', paddingVertical:10 },
  summaryDivider:  { width:0.5, backgroundColor:'rgba(42,38,32,.1)', marginVertical:8 },
  summaryLbl:      { fontSize:10, color:C.gray, textTransform:'uppercase', letterSpacing:0.5 },
  summaryVal:      { fontSize:13, fontWeight:'700', marginTop:2 },
  card:            { backgroundColor:C.white, borderRadius:14, padding:14, borderWidth:0.5, borderColor:'rgba(42,38,32,.1)' },
  cardTitle:       { fontSize:15, fontWeight:'700', color:C.dark, marginBottom:12 },
  txCard:          { backgroundColor:C.white, borderRadius:14, padding:14, marginBottom:10, borderWidth:0.5, borderColor:'rgba(42,38,32,.1)' },
  txRow:           { flexDirection:'row', alignItems:'center', paddingVertical:7, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.06)' },
  txDot:           { width:8, height:8, borderRadius:4, marginRight:10, marginTop:3 },
  txDesc:          { fontSize:14, fontWeight:'600', color:C.dark },
  txMeta:          { fontSize:12, color:C.gray, marginTop:2 },
  txAmt:           { fontSize:15, fontWeight:'700' },
  txActions:       { flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' },
  txThumb:         { width:'100%', height:120, borderRadius:8, backgroundColor:'#f0f0f0' },
  actBtn:          { paddingHorizontal:14, paddingVertical:7, borderRadius:8 },
  actBtnTxt:       { color:'#fff', fontSize:12, fontWeight:'600' },
  statCard:        { flex:1, backgroundColor:C.white, borderRadius:14, padding:14, borderWidth:0.5, borderColor:'rgba(42,38,32,.1)' },
  statLabel:       { fontSize:11, color:C.gray, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 },
  statValue:       { fontSize:20, fontWeight:'700', color:C.dark },
  pill:            { alignSelf:'flex-start', paddingHorizontal:8, paddingVertical:3, borderRadius:6 },
  pillTxt:         { fontSize:11, fontWeight:'600', textTransform:'capitalize' },
  avatar:          { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  avatarTxt:       { fontSize:18, fontWeight:'700' },
  empty:           { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  emptyTxt:        { color:C.gray, fontSize:14, fontStyle:'italic' },
  fab:             { position:'absolute', bottom:24, right:24, width:56, height:56, borderRadius:28, backgroundColor:C.dark, alignItems:'center', justifyContent:'center', elevation:5, shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.25, shadowRadius:4 },
  fabTxt:          { color:'#fff', fontSize:28, lineHeight:32 },
  lbl:             { fontSize:12, color:C.gray, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  inp:             { backgroundColor:C.white, borderWidth:0.5, borderColor:'rgba(42,38,32,.2)', borderRadius:10, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:C.dark },
  inpRow:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  btn:             { borderRadius:12, paddingVertical:14, alignItems:'center', borderWidth:0.5, borderColor:'rgba(42,38,32,.2)' },
  btnDark:         { backgroundColor:C.dark, borderColor:C.dark },
  btnTxt:          { fontSize:15, fontWeight:'600', color:C.dark },
  btnDarkTxt:      { fontSize:15, fontWeight:'600', color:'#fff' },
  toggleRow:       { flexDirection:'row', backgroundColor:'rgba(42,38,32,.06)', borderRadius:12, padding:4, gap:4 },
  toggleBtn:       { flex:1, paddingVertical:10, borderRadius:9, alignItems:'center' },
  toggleActive:    { backgroundColor:C.dark },
  toggleTxt:       { fontSize:14, fontWeight:'500', color:C.dark },
  toggleActiveTxt: { color:'#fff' },
  modalHeader:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.1)' },
  modalTitle:      { fontSize:18, fontWeight:'700', color:C.dark },
  pickerOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,.5)', justifyContent:'flex-end' },
  pickerBox:       { backgroundColor:C.bg, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'70%' },
  pickerItem:      { paddingHorizontal:20, paddingVertical:14, borderBottomWidth:0.5, borderColor:'rgba(42,38,32,.08)' },
  pickerItemTxt:   { fontSize:15, color:C.dark },
  roleBtn:         { borderWidth:1, borderColor:'rgba(42,38,32,.2)', borderRadius:10, paddingVertical:13, paddingHorizontal:14 },
  roleBtnTxt:      { fontSize:14, color:C.dark },
  faturaPreview:   { width:'100%', height:200, borderRadius:12, borderWidth:0.5, borderColor:'rgba(42,38,32,.2)', backgroundColor:'#f0f0f0' },
  scanBtn:         { width:'100%', borderRadius:16, padding:20, alignItems:'center', gap:6 },
  scanBtnTxt:      { color:'#fff', fontSize:17, fontWeight:'700' },
  scanBtnSub:      { color:'#ffffff99', fontSize:13 },
  imgOverlay:      { flex:1, backgroundColor:'rgba(0,0,0,.92)', alignItems:'center', justifyContent:'center', padding:16 },
  imgFull:         { width:'100%', height:'80%', borderRadius:12 },
});
