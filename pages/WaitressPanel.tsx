
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Hash, 
  UserRound, 
  Clock, 
  X, 
  PlusCircle, 
  CheckCircle,
  LogOut,
  Printer,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Truck,
  Plus
} from 'lucide-react';
import { Order, OrderStatus, Waitstaff, StoreSettings } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  onSelectTable: (table: string | null) => void;
  orders: Order[];
  settings: StoreSettings;
}

const WaitressPanel: React.FC<Props> = ({ onSelectTable, orders, settings }) => {
  const navigate = useNavigate();
  const [activeWaitstaff, setActiveWaitstaff] = useState<Waitstaff | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [printOrder, setPrintOrder] = useState<Order | any | null>(null);
  const [selectedTableModal, setSelectedTableModal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MAPA' | 'PEDIDOS'>('MAPA');
  
  const tables = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  useEffect(() => {
    const saved = localStorage.getItem('vovo-guta-waitstaff');
    if (saved) {
      setActiveWaitstaff(JSON.parse(saved));
    } else {
      setShowLogin(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const { data } = await supabase.from('waitstaff')
      .select('*')
      .eq('name', loginName)
      .eq('password', loginPass)
      .maybeSingle();

    if (data) {
      setActiveWaitstaff(data);
      localStorage.setItem('vovo-guta-waitstaff', JSON.stringify(data));
      setShowLogin(false);
    } else {
      setLoginError('Nome ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vovo-guta-waitstaff');
    setActiveWaitstaff(null);
    setShowLogin(true);
  };

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status === 'PREPARANDO' || o.status === 'PRONTO');
  }, [orders]);

  const occupiedTables = useMemo(() => {
    const map = new Map<string, { status: string, count: number }>();
    activeOrders.forEach(o => {
      if (o.tableNumber) {
        const current = map.get(o.tableNumber);
        if (!current || o.status === 'PRONTO') {
            map.set(o.tableNumber, { 
                status: o.status, 
                count: (current?.count || 0) + 1 
            });
        } else {
            map.set(o.tableNumber, {
                ...current,
                count: current.count + 1
            });
        }
      }
    });
    return map;
  }, [activeOrders]);

  const handleTableClick = (tableNum: string) => {
    if (!activeWaitstaff) {
        setShowLogin(true);
        return;
    }
    const occupation = occupiedTables.get(tableNum);
    if (occupation) {
      setSelectedTableModal(tableNum);
    } else {
      onSelectTable(tableNum);
      navigate('/cardapio');
    }
  };

  const handleQuickOrder = (type: 'BALCAO' | 'ENTREGA') => {
    if (!activeWaitstaff) {
        setShowLogin(true);
        return;
    }
    onSelectTable(null);
    navigate(`/cardapio?tipo=${type}`);
  };

  const handlePrint = (order: Order | any) => {
    setPrintOrder(order);
    setTimeout(() => {
        window.print();
        setPrintOrder(null);
    }, 300);
  };

  const handleMarkOrderReady = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'PRONTO' }).eq('id', orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    const isManager = activeWaitstaff?.role === 'GERENTE';
    const canCancel = settings.canWaitstaffCancelItems || isManager;

    if (!canCancel) {
      alert("Você não tem permissão para cancelar pedidos.");
      return;
    }

    if (window.confirm("Deseja realmente CANCELAR este pedido?")) {
      await supabase.from('orders').update({ status: 'CANCELADO' }).eq('id', orderId);
      setSelectedTableModal(null);
    }
  };

  const handleMarkTableAsReady = async (tableNum: string) => {
    if (window.confirm(`Deseja marcar todos os pedidos da Mesa ${tableNum} como PRONTOS?`)) {
      const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum && o.status === 'PREPARANDO');
      await Promise.all(tableOrders.map(o => supabase.from('orders').update({ status: 'PRONTO' }).eq('id', o.id)));
      setSelectedTableModal(null);
    }
  };

  const handleCancelTableOrders = async (tableNum: string) => {
    const isManager = activeWaitstaff?.role === 'GERENTE';
    const canCancel = settings.canWaitstaffCancelItems || isManager;

    if (!canCancel) {
      alert("Você não tem permissão para cancelar pedidos.");
      return;
    }

    if (window.confirm(`Deseja CANCELAR todos os pedidos ativos da Mesa ${tableNum}?`)) {
      const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum);
      await Promise.all(tableOrders.map(o => supabase.from('orders').update({ status: 'CANCELADO' }).eq('id', o.id)));
      setSelectedTableModal(null);
    }
  };

  const finishTableOrders = async (tableNum: string) => {
    const isManager = activeWaitstaff?.role === 'GERENTE';
    const canFinish = settings.canWaitstaffFinishOrder || isManager;

    if (!canFinish) {
        alert("Você não tem permissão para finalizar.");
        return;
    }

    if (window.confirm(`Finalizar todos os pedidos da Mesa ${tableNum}?`)) {
        const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum);
        await Promise.all(tableOrders.map(o => supabase.from('orders').update({ status: 'ENTREGUE' }).eq('id', o.id)));
        setSelectedTableModal(null);
    }
  };

  const handlePrintTableSummary = (tableNum: string) => {
    const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum);
    if (tableOrders.length === 0) return;

    const summaryItems: any[] = [];
    let total = 0;

    tableOrders.forEach(order => {
        total += order.total;
        order.items.forEach(item => {
            const existing = summaryItems.find(si => si.productId === item.productId);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                summaryItems.push({ ...item });
            }
        });
    });

    const summaryOrder = {
        id: `MESA-${tableNum}`,
        tableNumber: tableNum,
        items: summaryItems,
        total: total,
        type: 'MESA',
        createdAt: Date.now()
    };

    handlePrint(summaryOrder);
  };

  return (
    <div className="min-h-screen bg-primary p-4 md:p-8 relative overflow-x-hidden">
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff !important; }
          body * { visibility: hidden; }
          #thermal-receipt-waiter, #thermal-receipt-waiter * { visibility: visible; }
          #thermal-receipt-waiter { 
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: ${settings.thermalPrinterWidth || '80mm'}; 
            padding: 5mm;
            background: #fff; 
            font-family: 'Courier New', monospace; 
            font-size: 10pt; 
            color: #000;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-8 text-zinc-900">
        <header className="flex flex-col md:flex-row md:items-center justify-between text-white border-b border-white/10 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-secondary rounded-[1.5rem] shadow-xl text-white">
              <UserRound size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-brand font-bold tracking-tight">Atendimento</h1>
              <p className="text-secondary text-sm font-medium flex items-center gap-2">
                <Clock size={14} /> {activeWaitstaff ? `Olá, ${activeWaitstaff.name}!` : 'Aguardando Login'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleQuickOrder('BALCAO')} className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all text-xs font-bold">
                <ShoppingBag size={18} /> Novo Balcão
            </button>
            <button onClick={() => handleQuickOrder('ENTREGA')} className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all text-xs font-bold">
                <Truck size={18} /> Nova Entrega
            </button>
            <button onClick={handleLogout} className="p-3 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={24} />
            </button>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10">
          <button onClick={() => setActiveTab('MAPA')} className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'MAPA' ? 'bg-secondary text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}>
              MAPA DE MESAS
          </button>
          <button onClick={() => setActiveTab('PEDIDOS')} className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'PEDIDOS' ? 'bg-secondary text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}>
              CENTRAL DE PEDIDOS
          </button>
        </div>

        {activeTab === 'MAPA' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in">
              {tables.map(tableNum => {
              const occupation = occupiedTables.get(tableNum);
              const isReady = occupation?.status === 'PRONTO';
              const isPreparing = occupation?.status === 'PREPARANDO';

              return (
                  <button key={tableNum} onClick={() => handleTableClick(tableNum)} className={`relative overflow-hidden aspect-square rounded-[2rem] p-6 text-center transition-all border-2 flex flex-col items-center justify-center group active:scale-95 ${isReady ? 'bg-green-600 border-green-400 shadow-xl' : isPreparing ? 'bg-secondary border-secondary/50 shadow-xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <Hash size={16} className={`mb-1 ${occupation ? 'text-white/60' : 'text-secondary'}`} />
                    <span className="text-5xl font-bold text-white block mb-2">{tableNum}</span>
                    {occupation && (
                      <div className="absolute top-3 right-3 bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                          {occupation.count} items
                      </div>
                    )}
                  </button>
              );
              })}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-[2rem] p-5 shadow-xl flex flex-col border border-gray-100 relative group overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                               <div>
                                   <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1">
                                      {order.type === 'MESA' ? <Hash size={10}/> : order.type === 'ENTREGA' ? <Truck size={10}/> : <ShoppingBag size={10}/>}
                                      {order.type} {order.tableNumber && `• Mesa ${order.tableNumber}`}
                                   </p>
                                   <h3 className="font-bold text-primary truncate max-w-[150px]">{order.customerName || `Pedido #${order.id.slice(-4)}`}</h3>
                               </div>
                           </div>
                           <button onClick={() => handlePrint(order)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-secondary hover:text-white transition-all"><Printer size={18} /></button>
                        </div>
                        <div className="flex-1 space-y-1 mb-4 border-t pt-3 min-h-[100px]">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs font-medium text-gray-600">
                                    <span className="truncate mr-2">{item.isByWeight ? `${item.quantity.toFixed(3)}kg` : `${item.quantity}x`} {item.name}</span>
                                    <span className="shrink-0 font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-3 mt-auto pt-3 border-t">
                            <div className="flex justify-between items-center">
                              <p className="text-xl font-bold text-primary">R$ {order.total.toFixed(2)}</p>
                              <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${order.status === 'PRONTO' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                {order.status}
                              </span>
                            </div>
                            <div className="flex gap-2">
                               {order.status === 'PREPARANDO' && (
                                 <button onClick={() => handleMarkOrderReady(order.id)} className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Pronto</button>
                               )}
                               <button onClick={() => handleCancelOrder(order.id)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><XCircle size={18}/></button>
                               <button 
                                 onClick={() => {
                                   if (order.tableNumber) { finishTableOrders(order.tableNumber); }
                                   else { supabase.from('orders').update({ status: 'ENTREGUE' }).eq('id', order.id); }
                                 }} 
                                 className="flex-1 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                               >
                                 Finalizar
                               </button>
                            </div>
                        </div>
                    </div>
                ))}
                {activeOrders.length === 0 && (
                  <div className="col-span-full py-20 text-center text-white/20 italic">Nenhum pedido ativo no momento...</div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Modal de Ações da Mesa Ocupada */}
      {selectedTableModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-scale-up">
                <div className="p-8 border-b bg-gray-50 text-center relative">
                    <button onClick={() => setSelectedTableModal(null)} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-500"><X size={24}/></button>
                    <div className="w-16 h-16 bg-primary text-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Hash size={32} />
                    </div>
                    <h2 className="text-2xl font-brand font-bold text-primary">Mesa {selectedTableModal}</h2>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mt-1">O que deseja fazer?</p>
                </div>
                
                <div className="p-8 space-y-3">
                    <button 
                        onClick={() => { onSelectTable(selectedTableModal); navigate('/cardapio'); }} 
                        className="w-full flex items-center gap-4 p-4 bg-orange-50 hover:bg-orange-100 rounded-2xl border border-orange-100 transition-all group"
                    >
                        <div className="p-2 bg-white rounded-xl text-secondary shadow-sm group-hover:scale-110 transition-transform"><PlusCircle size={20}/></div>
                        <div className="text-left">
                            <p className="font-bold text-sm text-primary">Adicionar Item</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleMarkTableAsReady(selectedTableModal)} 
                        className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-100 transition-all group"
                    >
                        <div className="p-2 bg-white rounded-xl text-blue-500 shadow-sm group-hover:scale-110 transition-transform"><CheckCircle2 size={20}/></div>
                        <div className="text-left">
                            <p className="font-bold text-sm text-primary">Marcar como Pronto</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => handlePrintTableSummary(selectedTableModal)} 
                        className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-200 transition-all group"
                    >
                        <div className="p-2 bg-white rounded-xl text-gray-500 shadow-sm group-hover:scale-110 transition-transform"><Printer size={20}/></div>
                        <div className="text-left">
                            <p className="font-bold text-sm text-primary">Imprimir Extrato</p>
                        </div>
                    </button>

                    {(settings.canWaitstaffFinishOrder || activeWaitstaff?.role === 'GERENTE') && (
                        <button 
                            onClick={() => finishTableOrders(selectedTableModal)} 
                            className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 rounded-2xl border border-green-100 transition-all group"
                        >
                            <div className="p-2 bg-white rounded-xl text-green-600 shadow-sm group-hover:scale-110 transition-transform"><CheckCircle size={20}/></div>
                            <div className="text-left">
                                <p className="font-bold text-sm text-primary">Finalizar Mesa</p>
                            </div>
                        </button>
                    )}

                    {(settings.canWaitstaffCancelItems || activeWaitstaff?.role === 'GERENTE') && (
                      <button 
                        onClick={() => handleCancelTableOrders(selectedTableModal)} 
                        className="w-full flex items-center gap-4 p-4 bg-red-50 hover:bg-red-100 rounded-2xl border border-red-100 transition-all group"
                      >
                          <div className="p-2 bg-white rounded-xl text-red-500 shadow-sm group-hover:scale-110 transition-transform"><XCircle size={20}/></div>
                          <div className="text-left">
                              <p className="font-bold text-sm text-primary">Cancelar Pedidos</p>
                          </div>
                      </button>
                    )}
                </div>
                
                <div className="p-6 bg-gray-50 text-center">
                    <button onClick={() => setSelectedTableModal(null)} className="text-xs font-bold text-gray-400 uppercase tracking-widest">Voltar ao Mapa</button>
                </div>
            </div>
        </div>
      )}

      {printOrder && (
          <div id="thermal-receipt-waiter">
              <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
                  <p style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '1mm' }}>{settings.storeName.toUpperCase()}</p>
                  {settings.address && <p style={{ fontSize: '8pt', lineHeight: '1.2', margin: '1mm 0' }}>{settings.address}</p>}
                  <div style={{ borderTop: '1px solid #000', margin: '3mm 0' }}></div>
                  <p style={{ fontSize: '7pt' }}>{new Date().toLocaleString('pt-BR')}</p>
              </div>
              <div style={{ paddingBottom: '2mm' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt', textAlign: 'center' }}>
                    {printOrder.tableNumber ? `MESA: ${printOrder.tableNumber}` : `PEDIDO: #${printOrder.id?.slice(-4)}`}
                  </p>
                  {activeWaitstaff && <p style={{ fontSize: '8pt', marginTop: '1mm' }}>ATENDENTE: {activeWaitstaff.name.toUpperCase()}</p>}
              </div>
              <div style={{ borderTop: '1px dashed #000', padding: '2mm 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                            <th style={{ textAlign: 'left', fontSize: '8pt' }}>ITEM</th>
                            <th style={{ textAlign: 'right', fontSize: '8pt' }}>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                      {printOrder.items.map((it: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontSize: '9pt', padding: '1.5mm 0' }}>{it.isByWeight ? `${it.quantity.toFixed(3)}kg` : `${it.quantity}x`} {it.name.toUpperCase()}</td>
                          <td style={{ textAlign: 'right', fontSize: '9pt' }}>{(it.price * it.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
              <div style={{ borderTop: '1px solid #000', padding: '3mm 0', textAlign: 'right' }}>
                  <p style={{ fontSize: '12pt', fontWeight: 'bold' }}>TOTAL: R$ {printOrder.total.toFixed(2)}</p>
                  <p style={{ fontSize: '8pt', marginTop: '1mm' }}>PGTO: {printOrder.paymentMethod || 'A DEFINIR'}</p>
              </div>
          </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 z-[60] bg-primary flex items-center justify-center p-4">
            <div className="bg-white w-full max-md rounded-[3rem] p-10 shadow-2xl space-y-8 animate-scale-up">
                <div className="text-center">
                    <h1 className="text-2xl font-brand font-bold text-primary">Acesso Equipe</h1>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="text" placeholder="Nome" value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full px-4 py-4 bg-gray-50 border rounded-2xl outline-none" required />
                    <input type="password" placeholder="Senha" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-4 bg-gray-50 border rounded-2xl outline-none" required />
                    {loginError && <p className="text-xs text-red-500 font-bold px-2">{loginError}</p>}
                    <button type="submit" className="w-full py-5 bg-primary text-white rounded-2xl font-bold shadow-xl">Entrar</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default WaitressPanel;
