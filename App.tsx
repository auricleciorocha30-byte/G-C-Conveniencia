
import React, { useState, useEffect } from 'react';
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
  ChefHat
} from 'lucide-react';
import { supabase } from './lib/supabase.ts';
import { Product, Order, StoreSettings, Waitstaff } from './types.ts';
import { INITIAL_SETTINGS } from './constants.ts';

// Pages
import AdminDashboard from './pages/AdminDashboard.tsx';
import MenuManagement from './pages/MenuManagement.tsx';
import OrdersList from './pages/OrdersList.tsx';
import StoreSettingsPage from './pages/StoreSettingsPage.tsx';
import DigitalMenu from './pages/DigitalMenu.tsx';
import TVBoard from './pages/TVBoard.tsx';
import WaitressPanel from './pages/WaitressPanel.tsx';
import LoginPage from './pages/LoginPage.tsx';
import WaitstaffManagement from './pages/WaitstaffManagement.tsx';
import KitchenBoard from './pages/KitchenBoard.tsx';

const SOUNDS = {
  NEW_ORDER: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  ORDER_READY: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<Waitstaff | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isWaitstaff, setIsWaitstaff] = useState(() => !!localStorage.getItem('vovo-guta-waitstaff'));

  const mapOrderFromDb = (dbOrder: any): Order => {
    let changeForValue = dbOrder.change_for;
    if (!changeForValue && dbOrder.notes) {
      const match = dbOrder.notes.match(/\[TROCO PARA: R\$ ([\d.]+)\]/);
      if (match) changeForValue = parseFloat(match[1]);
    }
    return {
      ...dbOrder,
      createdAt: Number(dbOrder.created_at), // Mapeamento correto de snake_case para camelCase
      tableNumber: dbOrder.table_number,
      customerName: dbOrder.customer_name,
      customerPhone: dbOrder.customer_phone,
      deliveryAddress: dbOrder.delivery_address,
      paymentMethod: dbOrder.payment_method,
      waitstaffName: dbOrder.waitstaff_name,
      changeFor: changeForValue,
    };
  };

  const mapProductFromDb = (p: any): Product => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price),
    category: p.category,
    imageUrl: p.image_url || '',
    isActive: p.is_active ?? true,
    featuredDay: p.featured_day,
    isByWeight: p.is_by_weight ?? false
  });

  const mapProductToDb = (p: Product) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    image_url: p.imageUrl,
    is_active: p.isActive,
    featured_day: p.featuredDay,
    is_by_weight: p.isByWeight
  });

  useEffect(() => {
    if (!settingsLoading) {
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor || '#3d251e');
      document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor || '#f68c3e');
    }
  }, [settings.primaryColor, settings.secondaryColor, settingsLoading]);

  const playSound = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data.map(mapProductFromDb));
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [pRes, cRes, oRes, sRes] = await Promise.all([
          supabase.from('products').select('*').order('name'),
          supabase.from('categories').select('*').order('name'),
          supabase.from('orders').select('*').order('created_at', { ascending: false }), // Usando nome da coluna do banco
          supabase.from('settings').select('data').eq('id', 'store').maybeSingle()
        ]);

        if (pRes.data) setProducts(pRes.data.map(mapProductFromDb));
        if (cRes.data) setCategories(cRes.data.map((c: any) => c.name));
        if (oRes.data) setOrders(oRes.data.map(mapOrderFromDb));
        if (sRes.data && sRes.data.data) setSettings(sRes.data.data);
      } catch (err) {
        console.error('Erro inicial:', err);
      } finally {
        setSettingsLoading(false);
      }
    };

    fetchInitialData();

    const checkSession = async () => {
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

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAdminUser({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Admin',
          role: 'GERENTE'
        });
      } else if (event === 'SIGNED_OUT') {
        setAdminUser(null);
      }
    });

    const channel = supabase
      .channel('vovo-guta-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newOrder = mapOrderFromDb(payload.new);
          setOrders(prev => [newOrder, ...prev]);
          playSound(SOUNDS.NEW_ORDER);
        } else if (payload.eventType === 'UPDATE') {
          const updated = mapOrderFromDb(payload.new);
          setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
          if (updated.status === 'PRONTO') playSound(SOUNDS.ORDER_READY);
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new && payload.new.data) setSettings(payload.new.data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    try {
      const { error } = await supabase.from('settings').upsert({ id: 'store', data: newSettings });
      if (error) throw error;
      setSettings(newSettings);
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      throw err;
    }
  };

  const addOrder = async (order: Order) => {
    // Preparando payload com nomes de colunas snake_case para o Supabase
    const dbPayload: any = {
      id: order.id,
      type: order.type,
      items: order.items,
      status: order.status,
      total: order.total,
      created_at: order.createdAt, // Mapeamento correto de camelCase para snake_case
    };

    let finalNotes = order.notes || '';
    if (order.changeFor) {
      const trocoMsg = ` [TROCO PARA: R\$ ${order.changeFor.toFixed(2)}]`;
      finalNotes += trocoMsg;
    }

    if (finalNotes) dbPayload.notes = finalNotes;
    if (order.tableNumber) dbPayload.table_number = order.tableNumber;
    if (order.customerName) dbPayload.customer_name = order.customerName;
    if (order.customerPhone) dbPayload.customer_phone = order.customerPhone;
    if (order.deliveryAddress) dbPayload.delivery_address = order.deliveryAddress;
    if (order.paymentMethod) dbPayload.payment_method = order.paymentMethod;
    if (order.waitstaffName) dbPayload.waitstaff_name = order.waitstaffName;
    dbPayload.change_for = order.changeFor;

    const { error } = await supabase.from('orders').insert([dbPayload]);
    if (error) throw error;
  };

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) throw error;
  };

  const handleLogoutAdmin = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
  };

  const handleLogoutWaitstaff = () => {
    localStorage.removeItem('vovo-guta-waitstaff');
    setIsWaitstaff(false);
    setActiveTable(null);
    window.location.hash = '/garconete';
  };

  const handleCloseMenu = () => {
    setActiveTable(null);
    window.location.hash = '/garconete';
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={adminUser ? <Navigate to="/" /> : <LoginPage onLoginSuccess={(user) => setAdminUser(user)} />} />
        
        <Route path="/" element={adminUser ? <AdminLayout settings={settings} onLogout={handleLogoutAdmin} /> : <Navigate to="/login" />}>
          <Route index element={<AdminDashboard orders={orders} products={products} settings={settings} />} />
          <Route path="cardapio-admin" element={<MenuManagement products={products} saveProduct={async (p) => { 
            const dbProduct = mapProductToDb(p);
            const { error } = await supabase.from('products').upsert(dbProduct); 
            if (error) throw error;
          }} deleteProduct={async (id) => { await supabase.from('products').delete().eq('id', id); }} categories={categories} setCategories={setCategories} />} />
          <Route path="pedidos" element={<OrdersList orders={orders} updateStatus={updateOrderStatus} products={products} addOrder={addOrder} settings={settings} />} />
          <Route path="equipe" element={<WaitstaffManagement settings={settings} onUpdateSettings={handleUpdateSettings} />} />
          <Route path="configuracoes" element={<StoreSettingsPage settings={settings} products={products} onSave={handleUpdateSettings} />} />
        </Route>

        <Route path="/cozinha" element={<KitchenBoard orders={orders} updateStatus={updateOrderStatus} />} />
        <Route path="/garconete" element={<WaitressPanel orders={orders} settings={settings} onSelectTable={(t) => { setActiveTable(t); setIsWaitstaff(true); }} />} />
        <Route path="/cardapio" element={<DigitalMenu products={products} categories={categories} settings={settings} orders={orders} addOrder={addOrder} tableNumber={activeTable} onLogout={handleLogoutWaitstaff} onCloseMenu={handleCloseMenu} isWaitstaff={isWaitstaff} />} />
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
      <header className="md:hidden sticky top-0 z-[60] bg-primary text-white p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <img src={settings.logoUrl} className="w-8 h-8 rounded-full object-cover border border-secondary" alt="Store Logo" />
          <span className="font-brand text-sm font-bold truncate max-w-[150px]">{settings.storeName}</span>
        </div>
        <button 
          onClick={onLogout} 
          className="p-2 bg-white/10 rounded-xl flex items-center gap-2 hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">Sair</span>
          <LogOut size={18} />
        </button>
      </header>

      <aside className="w-64 bg-primary text-white hidden md:flex flex-col border-r border-black/10 transition-colors duration-500">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src={settings.logoUrl} className="w-10 h-10 rounded-full object-cover border-2 border-secondary shadow-md" alt="Store Logo" />
          <span className="font-brand text-lg font-bold truncate">{settings.storeName}</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="pb-2 px-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Administração</div>
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${location.pathname === item.to ? 'bg-secondary' : 'hover:bg-white/5'}`}>
              {item.icon} {item.label}
            </Link>
          ))}
          
          <div className="pt-6 pb-2 px-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Visualizar Cardápio</div>
          <a href="#/cardapio" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-secondary font-bold group border border-dashed border-white/10 mx-2">
            <div className="flex items-center gap-3"><Utensils size={20} /> Cardápio Digital</div>
            <ExternalLink size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          </a>

          <div className="pt-6 pb-2 px-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Atalhos Operação</div>
          <a href="#/cozinha" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-gray-300 group">
            <div className="flex items-center gap-3"><ChefHat size={20} /> Painel Cozinha</div>
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <a href="#/garconete" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-gray-300 group">
            <div className="flex items-center gap-3"><UserRound size={20} /> Painel Garçom</div>
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <a href="#/tv" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-gray-300 group">
            <div className="flex items-center gap-3"><Tv size={20} /> Painel TV</div>
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-bold transition-colors">
            <LogOut size={18} /> Sair do Admin
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto md:p-8 p-4 bg-gray-50 text-zinc-900">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-20 md:hidden flex items-center justify-around px-1 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {menuItems.map(item => (
          <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 transition-all px-2 py-2 rounded-xl flex-1 ${location.pathname === item.to ? 'text-secondary' : 'text-gray-400'}`}>
            <div className={location.pathname === item.to ? 'scale-110 transition-transform' : ''}>{item.icon}</div>
            <span className="text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
