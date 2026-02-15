
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Settings, 
  PlusCircle, 
  LogOut,
  Loader2,
  UserRound,
  ExternalLink,
  Utensils,
  Tv,
  Users,
  Zap,
  ChefHat,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell
} from 'lucide-react';
import { supabase } from './lib/supabase.ts';
import { Product, Order, StoreSettings, Waitstaff, OrderStatus } from './types.ts';
import { INITIAL_SETTINGS } from './constants.ts';

// Pages
import AdminDashboard from './pages/AdminDashboard.tsx';
import MenuManagement from './pages/MenuManagement.tsx';
import OrdersList from './pages/OrdersList.tsx';
import StoreSettingsPage from './pages/StoreSettingsPage.tsx';
import DigitalMenu from './pages/DigitalMenu.tsx';
import TVBoard from './pages/TVBoard.tsx';
import AttendantPanel from './pages/AttendantPanel.tsx';
import LoginPage from './pages/LoginPage.tsx';
import WaitstaffManagement from './pages/WaitstaffManagement.tsx';
import KitchenBoard from './pages/KitchenBoard.tsx';

const SOUNDS = {
  NEW_ORDER: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  ORDER_READY: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
};

const CACHE_KEYS = {
  PRODUCTS: 'gc-conveniencia-products-v1',
  SETTINGS: 'gc-conveniencia-settings-v1',
  OFFLINE_ORDERS: 'gc-conveniencia-offline-orders-v1'
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem(CACHE_KEYS.PRODUCTS);
    return cached ? JSON.parse(cached) : [];
  });
  
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const cached = localStorage.getItem(CACHE_KEYS.SETTINGS);
    return cached ? JSON.parse(cached) : INITIAL_SETTINGS;
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminUser, setAdminUser] = useState<Waitstaff | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTable, setActiveTable] = useState<string | null>(null);

  const initialLoadRef = useRef(true);

  const playAudio = (url: string) => {
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.play().catch(e => console.warn('Som bloqueado pelo navegador:', e));
  };

  const applyColors = useCallback((s: StoreSettings) => {
    document.documentElement.style.setProperty('--primary-color', s.primaryColor || '#001F3F');
    document.documentElement.style.setProperty('--secondary-color', s.secondaryColor || '#FFD700');
  }, []);

  const mapProductFromDb = (p: any): Product => ({
    id: p.id.toString(),
    name: p.name,
    description: p.description || '',
    price: Number(p.price),
    category: p.category,
    imageUrl: p.image_url || '',
    isActive: p.is_active ?? true,
    featuredDay: p.featured_day === null ? undefined : p.featured_day,
    isByWeight: p.is_by_weight ?? false
  });

  const mapProductToDb = (p: Product) => ({
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    image_url: p.imageUrl,
    is_active: p.isActive,
    featured_day: p.featuredDay === undefined || p.featuredDay === -1 ? null : p.featuredDay,
    is_by_weight: p.isByWeight
  });

  const mapOrderFromDb = (dbOrder: any): Order => ({
    id: dbOrder.id.toString(),
    type: dbOrder.type,
    items: dbOrder.items,
    status: dbOrder.status,
    total: Number(dbOrder.total),
    createdAt: dbOrder.created_at ? (isNaN(Number(dbOrder.created_at)) ? new Date(dbOrder.created_at).getTime() : Number(dbOrder.created_at)) : Date.now(),
    tableNumber: dbOrder.table_number,
    customerName: dbOrder.customer_name,
    customerPhone: dbOrder.customer_phone,
    deliveryAddress: dbOrder.delivery_address,
    paymentMethod: dbOrder.payment_method,
    notes: dbOrder.notes,
    changeFor: dbOrder.change_for ? Number(dbOrder.change_for) : undefined,
    waitstaffName: dbOrder.waitstaff_name,
    couponApplied: dbOrder.coupon_applied,
    discountAmount: dbOrder.discount_amount ? Number(dbOrder.discount_amount) : undefined,
    isSynced: true
  });

  const mapOrderToDb = (order: Order) => {
    const numericId = !isNaN(Number(order.id)) ? Number(order.id) : Date.now();
    
    return {
      id: numericId,
      type: order.type,
      items: order.items,
      status: order.status,
      total: order.total,
      created_at: order.createdAt, 
      notes: order.notes,
      table_number: order.tableNumber,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      delivery_address: order.deliveryAddress,
      payment_method: order.paymentMethod,
      waitstaff_name: order.waitstaffName,
      change_for: order.changeFor,
      coupon_applied: order.couponApplied,
      discount_amount: order.discountAmount
    };
  };

  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAdminUser({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Admin',
          role: 'GERENTE'
        });
      }
      setAuthLoading(false);
    };
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAdminUser({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Admin',
          role: 'GERENTE'
        });
      } else {
        setAdminUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, cRes, oRes, sRes] = await Promise.all([
          supabase.from('products').select('*').order('name'),
          supabase.from('categories').select('*').order('name'),
          supabase.from('orders').select('*').order('id', { ascending: false }).limit(200),
          supabase.from('settings').select('data').eq('id', 'store').maybeSingle()
        ]);

        if (pRes.data) {
          const mapped = pRes.data.map(mapProductFromDb);
          setProducts(mapped);
          localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(mapped));
        }
        if (cRes.data) setCategories(cRes.data.map((c: any) => c.name));
        if (oRes.data) {
          const mappedOrders = oRes.data.map(mapOrderFromDb);
          setOrders(mappedOrders);
        }
        if (sRes.data?.data) {
          setSettings(sRes.data.data);
          localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(sRes.data.data));
          applyColors(sRes.data.data);
        }
        initialLoadRef.current = false;
      } catch (err) {
        console.warn('Modo offline detectado.');
      }
    };
    fetchData();

    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = mapOrderFromDb(payload.new);
        setOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          if (!initialLoadRef.current) playAudio(SOUNDS.NEW_ORDER);
          return [newOrder, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updated = mapOrderFromDb(payload.new);
        setOrders(prev => {
          const old = prev.find(o => o.id === updated.id);
          if (old?.status !== 'PRONTO' && updated.status === 'PRONTO') {
            if (!initialLoadRef.current) playAudio(SOUNDS.ORDER_READY);
          }
          return prev.map(o => o.id === updated.id ? updated : o);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [applyColors]);

  const addOrder = async (order: Order) => {
    const dbObject = mapOrderToDb(order);
    const { data, error } = await supabase.from('orders').insert([dbObject]).select();
    
    if (error) {
      console.error("Erro Supabase:", error);
      throw error;
    }

    if (data && data[0]) {
        const insertedOrder = mapOrderFromDb(data[0]);
        setOrders(prev => [insertedOrder, ...prev]);
    }
  };

  const handleSaveProduct = async (p: Product) => {
    const dbObj = mapProductToDb(p);
    const { error } = await supabase.from('products').upsert([{ ...dbObj, id: p.id.includes('.') ? undefined : p.id }]);
    if (error) throw error;
    
    setProducts(prev => {
      const next = prev.some(item => item.id === p.id) ? prev.map(item => item.id === p.id ? p : item) : [...prev, p];
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    setProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(next));
      return next;
    });
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status }).eq('id', id);
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    const { error } = await supabase.from('settings').upsert({ id: 'store', data: newSettings });
    if (error) throw error;
    setSettings(newSettings);
    localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(newSettings));
    applyColors(newSettings);
  };

  if (authLoading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={48} /></div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={adminUser ? <Navigate to="/" /> : <LoginPage onLoginSuccess={setAdminUser} />} />
        <Route path="/" element={adminUser ? <AdminLayout settings={settings} onLogout={() => supabase.auth.signOut()} /> : <Navigate to="/login" />}>
          <Route index element={<AdminDashboard orders={orders} products={products} settings={settings} />} />
          <Route path="cardapio-admin" element={<MenuManagement products={products} saveProduct={handleSaveProduct} deleteProduct={handleDeleteProduct} categories={categories} setCategories={setCategories} />} />
          <Route path="pedidos" element={<OrdersList orders={orders} updateStatus={updateOrderStatus} products={products} addOrder={addOrder} settings={settings} />} />
          <Route path="equipe" element={<WaitstaffManagement settings={settings} onUpdateSettings={handleUpdateSettings} />} />
          <Route path="configuracoes" element={<StoreSettingsPage settings={settings} products={products} onSave={handleUpdateSettings} />} />
        </Route>
        <Route path="/atendimento" element={<AttendantPanel orders={orders} settings={settings} onSelectTable={setActiveTable} />} />
        <Route path="/cozinha" element={<KitchenBoard orders={orders} updateStatus={updateOrderStatus} />} />
        <Route path="/cardapio" element={<DigitalMenu products={products} categories={categories} settings={settings} orders={orders} addOrder={addOrder} tableNumber={activeTable} onLogout={() => setActiveTable(null)} isWaitstaff={!!localStorage.getItem('vovo-guta-waitstaff')} />} />
        <Route path="/tv" element={<TVBoard orders={orders} settings={settings} products={products} />} />
        <Route path="*" element={<Navigate to="/cardapio" />} />
      </Routes>
    </HashRouter>
  );
}

function AdminLayout({ settings, onLogout }: { settings: StoreSettings, onLogout: () => void }) {
  const location = useLocation();
  const menuItems = [
    { to: '/', label: 'Início', icon: <LayoutDashboard size={20} /> },
    { to: '/pedidos', label: 'Pedidos', icon: <ShoppingCart size={20} /> },
    { to: '/cardapio-admin', label: 'Menu', icon: <PlusCircle size={20} /> },
    { to: '/equipe', label: 'Time', icon: <Users size={20} /> },
    { to: '/configuracoes', label: 'Ajustes', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 pb-20 md:pb-0">
      <aside className="w-64 bg-primary text-white hidden md:flex flex-col border-r border-black/10">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src={settings.logoUrl} className="w-10 h-10 rounded-full border-2 border-secondary" alt="Logo" />
          <span className="font-brand text-lg font-bold truncate">{settings.storeName}</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${location.pathname === item.to ? 'bg-secondary' : 'hover:bg-white/5'}`}>
              {item.icon} {item.label}
            </Link>
          ))}
          <div className="pt-6 pb-2 px-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest text-white/40">Atalhos Externos</div>
          <a href="#/atendimento" target="_blank" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-orange-400 font-bold"><UserRound size={20} /> Painel Atendente</a>
          <a href="#/cardapio" target="_blank" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-secondary"><Utensils size={20} /> Cardápio Digital</a>
          <a href="#/cozinha" target="_blank" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300"><ChefHat size={20} /> Cozinha</a>
          <a href="#/tv" target="_blank" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300"><Tv size={20} /> Painel TV</a>
        </nav>
        <div className="p-4 border-t border-white/10"><button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-red-400 font-bold"><LogOut size={18} /> Sair</button></div>
      </aside>
      <main className="flex-1 overflow-auto md:p-8 p-4 bg-gray-50 text-zinc-900"><Outlet /></main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t h-20 md:hidden flex items-center justify-around z-50">
        {menuItems.map(item => (
          <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 flex-1 ${location.pathname === item.to ? 'text-secondary' : 'text-gray-400'}`}>{item.icon}<span className="text-[9px] font-bold uppercase">{item.label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
