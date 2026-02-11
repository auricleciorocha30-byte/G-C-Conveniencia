
export type OrderStatus = 'PREPARANDO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO';
export type OrderType = 'MESA' | 'BALCAO' | 'ENTREGA';
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO';

export interface Waitstaff {
  id: string;
  name: string;
  password?: string;
  role: 'GERENTE' | 'GARCOM';
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  featuredDay?: number;
  isByWeight?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  isByWeight?: boolean;
}

export interface Order {
  id: string;
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
  paymentMethod?: PaymentMethod;
  deliveryAddress?: string;
  notes?: string;
  changeFor?: number;
  waitstaffName?: string;
  couponApplied?: string;
  discountAmount?: number;
}

export interface StoreSettings {
  isStoreOpen?: boolean;
  isDeliveryActive: boolean;
  isTableOrderActive: boolean;
  isCounterPickupActive: boolean;
  storeName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  canWaitstaffFinishOrder: boolean;
  canWaitstaffCancelItems: boolean;
  thermalPrinterWidth: '80mm' | '58mm';
  address?: string;
  whatsapp?: string;
  couponName?: string;
  couponDiscount?: number;
  isCouponActive?: boolean;
  applicableProductIds?: string[];
}

export interface Coupon {
  code: string;
  discount: number;
  isActive: boolean;
}
