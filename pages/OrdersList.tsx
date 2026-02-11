
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Product, OrderType, OrderItem, StoreSettings } from '../types';
import { Clock, Printer, UserRound, CheckCircle2, DollarSign, AlertCircle, MapPin, Phone, MessageSquare } from 'lucide-react';

interface Props {
  orders: Order[];
  updateStatus: (id: string, status: OrderStatus) => void;
  products: Product[];
  addOrder: (order: Order) => void;
  settings: StoreSettings;
}

interface GroupedOrder {
  id: string;
  originalOrderIds: string[];
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
  paymentMethod?: string;
  deliveryAddress?: string;
  notes: string[];
  waitstaffName?: string;
  changeFor?: number;
}

const OrdersList: React.FC<Props> = ({ orders, updateStatus, products, addOrder, settings }) => {
  const [filterType, setFilterType] = useState<'TODOS' | OrderType>('TODOS');
  const [printOrder, setPrintOrder] = useState<GroupedOrder | null>(null);

  const displayGroups = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'ENTREGUE' && o.status !== 'CANCELADO');
    const filtered = activeOrders.filter(o => filterType === 'TODOS' || o.type === filterType);
    
    const groups: Record<string, GroupedOrder> = {};

    filtered.forEach(order => {
      const groupKey = (order.type === 'MESA' && order.tableNumber) ? `MESA-${order.tableNumber}` : order.id;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: order.id,
          originalOrderIds: [order.id],
          type: order.type,
          tableNumber: order.tableNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          items: [...order.items],
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          deliveryAddress: order.deliveryAddress,
          notes: order.notes && order.notes.trim() !== "" ? [order.notes] : [],
          waitstaffName: order.waitstaffName,
          changeFor: order.changeFor
        };
      } else {
        const group = groups[groupKey];
        group.originalOrderIds.push(order.id);
        group.total += order.total;
        if (order.waitstaffName) group.waitstaffName = order.waitstaffName;
        if (order.status === 'PRONTO') group.status = 'PRONTO';
        if (order.changeFor) group.changeFor = order.changeFor;
        
        order.items.forEach(newItem => {
          const existingItem = group.items.find(i => i.productId === newItem.productId);
          if (existingItem) existingItem.quantity += newItem.quantity;
          else group.items.push({ ...newItem });
        });
        if (order.notes && order.notes.trim() !== "") group.notes.push(order.notes);
      }
    });

    return Object.values(groups).sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, filterType]);

  const handlePrint = (group: GroupedOrder) => {
    setPrintOrder(group);
    setTimeout(() => { 
      window.print(); 
      setPrintOrder(null); 
    }, 200);
  };

  const handleStatusUpdate = async (group: GroupedOrder, newStatus: OrderStatus) => {
    await Promise.all(group.originalOrderIds.map(id => updateStatus(id, newStatus)));
  };

  return (
    <div className="space-y-6 text-zinc-900">
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff !important; }
          body * { visibility: hidden; }
          #thermal-receipt, #thermal-receipt * { visibility: visible; }
          #thermal-receipt { 
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

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['TODOS', 'MESA', 'BALCAO', 'ENTREGA'].map(f => (
            <button key={f} onClick={() => setFilterType(f as any)} className={`px-6 py-2.5 rounded-2xl font-bold text-sm border transition-all ${filterType === f ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{f}</button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayGroups.map(group => (
          <div key={group.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${group.type === 'ENTREGA' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    {group.type} {group.tableNumber && `(Mesa ${group.tableNumber})`}
                  </span>
                  {group.waitstaffName && (
                    <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      <UserRound size={10} /> {group.waitstaffName}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-2 truncate">
                  {group.customerName || `Pedido #${group.id.slice(-4)}`}
                </h3>
              </div>
              <button onClick={() => handlePrint(group)} className="p-2 text-gray-400 hover:text-orange-500 transition-colors shrink-0"><Printer size={18} /></button>
            </div>

            <div className="flex-1 space-y-2 mb-6 border-t pt-4">
              {group.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700"><strong>{item.isByWeight ? `${item.quantity.toFixed(3)}kg` : `${item.quantity}x`}</strong> {item.name}</span>
                  <span className="font-mono font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 flex justify-between items-center mt-auto">
              <div>
                <p className="text-2xl font-brand font-bold text-primary">R$ {group.total.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                 {group.status === 'PREPARANDO' && (
                   <button onClick={() => handleStatusUpdate(group, 'PRONTO')} className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Pronto</button>
                 )}
                 <button onClick={() => handleStatusUpdate(group, 'ENTREGUE')} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all">Concluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {printOrder && (
          <div id="thermal-receipt">
              <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
                  <p style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '1mm' }}>{settings.storeName.toUpperCase()}</p>
                  {settings.address && <p style={{ fontSize: '8pt', lineHeight: '1.2', margin: '1mm 0' }}>{settings.address}</p>}
                  <div style={{ borderTop: '1px solid #000', margin: '3mm 0' }}></div>
                  <p style={{ fontSize: '7pt' }}>{new Date().toLocaleString('pt-BR')}</p>
              </div>
              
              <div style={{ paddingBottom: '2mm' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt', textAlign: 'center', marginBottom: '2mm' }}>
                    {printOrder.tableNumber ? `MESA: ${printOrder.tableNumber}` : `PEDIDO: #${printOrder.id.slice(-4)}`}
                  </p>
                  {printOrder.customerName && <p style={{ fontSize: '9pt' }}>CLIENTE: {printOrder.customerName.toUpperCase()}</p>}
              </div>

              <div style={{ borderTop: '1px dashed #000', padding: '2mm 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {printOrder.items.map((it, i) => (
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
    </div>
  );
};

export default OrdersList;
