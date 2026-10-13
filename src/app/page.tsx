'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, Tag, User, 
  CreditCard, Banknote, Smartphone, DollarSign, Printer, 
  RotateCcw, Clock, Lock, CheckCircle2, ChevronRight, X, 
  LayoutDashboard, AlertCircle, Bookmark, ArrowLeftRight, HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  color: string;
  stock_quantity: number;
  track_stock: number;
  barcode?: string;
  sku?: string;
  variations: any[];
  modifiers: any[];
}

interface CartItem {
  id: string;
  productId: string;
  variationId?: string | null;
  productName: string;
  variationName?: string | null;
  quantity: number;
  unitPrice: number; // in cents
  discountAmount: number; // in cents
  selectedModifiers: Array<{
    modifierId: string;
    modifierName: string;
    optionId: string;
    optionName: string;
    price: number;
  }>;
  note?: string;
}

export default function POSPage() {
  // Catalog State
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [diningOptions, setDiningOptions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);

  // Active Session & Selections
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiningOption, setSelectedDiningOption] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<any>(null);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  // Modals
  const [showItemModal, setShowItemModal] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [selectedModOptions, setSelectedModOptions] = useState<Record<string, any>>({});
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET' | 'OTHER'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftTab, setShiftTab] = useState<'INFO' | 'PAY_IN_OUT' | 'CLOSE'>('INFO');
  const [cashMovementType, setCashMovementType] = useState<'PAY_IN' | 'PAY_OUT'>('PAY_IN');
  const [cashMovementAmount, setCashMovementAmount] = useState('');
  const [cashMovementReason, setCashMovementReason] = useState('');
  const [actualClosingCash, setActualClosingCash] = useState('');

  const [showOpenTicketsModal, setShowOpenTicketsModal] = useState(false);
  const [openTickets, setOpenTickets] = useState<any[]>([]);
  const [ticketNameInput, setTicketNameInput] = useState('');
  const [showSaveTicketModal, setShowSaveTicketModal] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Barcode scanner buffer
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  // Load catalog on mount
  const loadCatalog = async () => {
    try {
      const res = await fetch('/api/pos/catalog');
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setCategories(data.data.categories);
        setProducts(data.data.products);
        setDiscounts(data.data.discounts);
        setDiningOptions(data.data.diningOptions);
        setCustomers(data.data.customers);
        setCashiers(data.data.cashiers);
        setCurrentShift(data.data.currentShift);

        if (data.data.diningOptions.length > 0) {
          const defaultOpt = data.data.diningOptions.find((d: any) => d.is_default === 1);
          setSelectedDiningOption(defaultOpt ? defaultOpt.id : data.data.diningOptions[0].id);
        }

        if (data.data.cashiers.length > 0 && !currentUser) {
          setCurrentUser(data.data.cashiers[0]);
        }
      }
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // USB Barcode Scanner Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime.current;
      lastKeyTime.current = currentTime;

      // Scanners type fast (< 40ms between keys)
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          const scannedCode = barcodeBuffer.current;
          barcodeBuffer.current = '';
          handleBarcodeScanned(scannedCode);
        }
        barcodeBuffer.current = '';
      } else if (e.key.length === 1) {
        if (diff > 100) barcodeBuffer.current = '';
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const handleBarcodeScanned = (code: string) => {
    const matched = products.find(p => p.barcode === code || p.sku === code);
    if (matched) {
      handleProductClick(matched);
    } else {
      alert(`Código de barra no encontrado: ${code}`);
    }
  };

  // Add Product to Cart or open customizer modal
  const handleProductClick = (product: Product) => {
    if ((product.variations && product.variations.length > 0) || (product.modifiers && product.modifiers.length > 0)) {
      setShowItemModal(product);
      setSelectedVariation(product.variations?.[0] || null);
      setSelectedModOptions({});
      return;
    }

    addToCartDirect(product, null, []);
  };

  const addToCartDirect = (
    product: Product, 
    variation: any | null, 
    modifiers: any[]
  ) => {
    const unitPrice = variation ? variation.price : product.price;
    const cartItemId = `${product.id}_${variation?.id || 'base'}_${modifiers.map(m => m.optionId).sort().join('-')}`;

    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        return prev.map(item => 
          item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            id: cartItemId,
            productId: product.id,
            variationId: variation?.id || null,
            productName: product.name,
            variationName: variation?.name || null,
            quantity: 1,
            unitPrice,
            discountAmount: 0,
            selectedModifiers: modifiers,
          }
        ];
      }
    });
  };

  const confirmCustomItem = () => {
    if (!showItemModal) return;
    const chosenMods = Object.values(selectedModOptions);
    addToCartDirect(showItemModal, selectedVariation, chosenMods);
    setShowItemModal(null);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(null);
    setSavedOrderId(null);
  };

  // Calculations
  const { subtotalCents, discountCents, taxCents, grandTotalCents } = useMemo(() => {
    let sub = 0;
    for (const item of cart) {
      let modSum = 0;
      for (const m of item.selectedModifiers) modSum += m.price;
      sub += Math.round((item.unitPrice + modSum) * item.quantity);
    }

    let disc = 0;
    if (cartDiscount) {
      if (cartDiscount.type === 'PERCENTAGE') {
        disc = Math.round(sub * (cartDiscount.value / 100));
      } else {
        disc = Math.min(sub, cartDiscount.value);
      }
    }

    const netSub = Math.max(0, sub - disc);
    const taxRate = store?.tax_rate ?? 0.18;
    const taxType = store?.tax_type ?? 'INCLUDED';

    let tax = 0;
    let total = netSub;

    if (taxType === 'INCLUDED') {
      tax = Math.round(netSub - (netSub / (1 + taxRate)));
      total = netSub;
    } else {
      tax = Math.round(netSub * taxRate);
      total = netSub + tax;
    }

    return {
      subtotalCents: sub,
      discountCents: disc,
      taxCents: tax,
      grandTotalCents: total,
    };
  }, [cart, cartDiscount, store]);

  // Currency Formatter
  const formatMoney = (cents: number) => {
    const sym = store?.currency_symbol || 'S/';
    return `${sym} ${(cents / 100).toFixed(2)}`;
  };

  // Filter Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Open Checkout Modal
  const startCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('CASH');
    setCashTendered((grandTotalCents / 100).toFixed(2));
    setReferenceNumber('');
    setShowCheckoutModal(true);
  };

  // Execute Checkout
  const handleCheckoutSubmit = async () => {
    if (!currentUser) return;
    setIsProcessingCheckout(true);

    try {
      const payload = {
        shiftId: currentShift?.id || null,
        userId: currentUser.id,
        customerId: selectedCustomer?.id || null,
        diningOptionId: selectedDiningOption || null,
        items: cart.map(i => ({
          productId: i.productId,
          variationId: i.variationId,
          productName: i.productName,
          variationName: i.variationName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          selectedModifiers: i.selectedModifiers,
        })),
        overallDiscountId: cartDiscount?.id || null,
        overallDiscountAmount: discountCents,
        paymentMethod,
        cashTendered: paymentMethod === 'CASH' ? Math.round(parseFloat(cashTendered || '0') * 100) : undefined,
        referenceNumber: referenceNumber || null,
        savedOrderId: savedOrderId || null,
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Error al procesar la venta');
        return;
      }

      setCompletedOrder(data.data);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      clearCart();
      loadCatalog(); // Refresh inventory stock & shift
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Open Tickets Handlers
  const fetchOpenTickets = async () => {
    const res = await fetch('/api/pos/tickets');
    const data = await res.json();
    if (data.success) {
      setOpenTickets(data.data);
      setShowOpenTicketsModal(true);
    }
  };

  const handleSaveTicket = async () => {
    if (cart.length === 0) return;
    if (!ticketNameInput.trim()) {
      alert('Por favor ingrese un nombre o mesa para el ticket');
      return;
    }

    try {
      const res = await fetch('/api/pos/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: currentShift?.id || null,
          userId: currentUser?.id,
          customerId: selectedCustomer?.id || null,
          diningOptionId: selectedDiningOption || null,
          ticketName: ticketNameInput.trim(),
          savedOrderId: savedOrderId || null,
          items: cart.map(i => ({
            productId: i.productId,
            variationId: i.variationId,
            productName: i.productName,
            variationName: i.variationName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            selectedModifiers: i.selectedModifiers,
          }))
        })
      });

      const data = await res.json();
      if (data.success) {
        clearCart();
        setShowSaveTicketModal(false);
        setTicketNameInput('');
        alert('Ticket guardado exitosamente');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const restoreOpenTicket = (ticket: any) => {
    setSavedOrderId(ticket.id);
    const restoredItems: CartItem[] = ticket.items.map((item: any) => ({
      id: `${item.product_id}_${item.variation_id || 'base'}_${Math.random()}`,
      productId: item.product_id,
      variationId: item.variation_id,
      productName: item.product_name,
      variationName: item.variation_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
      selectedModifiers: item.selected_modifiers_json ? JSON.parse(item.selected_modifiers_json) : [],
    }));

    setCart(restoredItems);
    if (ticket.dining_option_id) setSelectedDiningOption(ticket.dining_option_id);
    if (ticket.customer_id) {
      const cust = customers.find(c => c.id === ticket.customer_id);
      setSelectedCustomer(cust || null);
    }
    setShowOpenTicketsModal(false);
  };

  // Cashier PIN switch with server-side validation
  const handlePinSubmit = async () => {
    try {
      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        setShowPinModal(false);
        setEnteredPin('');
        setPinError('');
      } else {
        setPinError(data.error || 'PIN incorrecto. Intente nuevamente.');
        setEnteredPin('');
      }
    } catch {
      setPinError('Error de red al verificar PIN');
      setEnteredPin('');
    }
  };

  // Shift Actions
  const handleCashMovementSubmit = async () => {
    const amt = Math.round(parseFloat(cashMovementAmount || '0') * 100);
    if (amt <= 0) return alert('Ingrese un monto válido');

    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CASH_MOVEMENT',
        shiftId: currentShift.id,
        userId: currentUser.id,
        type: cashMovementType,
        amount: amt,
        reason: cashMovementReason || (cashMovementType === 'PAY_IN' ? 'Entrada de efectivo' : 'Salida de efectivo'),
      })
    });

    const data = await res.json();
    if (data.success) {
      setCashMovementAmount('');
      setCashMovementReason('');
      setShiftTab('INFO');
      loadCatalog();
    } else {
      alert(data.error);
    }
  };

  const handleCloseShiftSubmit = async () => {
    const actual = Math.round(parseFloat(actualClosingCash || '0') * 100);
    if (isNaN(actual)) return alert('Ingrese el efectivo contado en caja');

    const res = await fetch('/api/pos/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CLOSE',
        shiftId: currentShift.id,
        actualCashCents: actual,
        note: 'Cierre de turno verificado por cajero',
      })
    });

    const data = await res.json();
    if (data.success) {
      alert('Turno cerrado exitosamente');
      setShowShiftModal(false);
      loadCatalog();
    } else {
      alert(data.error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="font-medium text-slate-300">Cargando Sistema POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* LEFT AREA: Catalog & Grid (65% width) */}
      <div className="flex flex-1 flex-col border-r border-slate-800">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
              title="Cambiar Cajero"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">
                {currentUser?.name?.charAt(0) || 'U'}
              </div>
              <span>{currentUser?.name || 'Cajero'}</span>
              <Lock className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Shift Badge */}
            <button
              onClick={() => setShowShiftModal(true)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                currentShift 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900' 
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{currentShift ? 'Turno Abierto' : 'Turno Cerrado'}</span>
            </button>

            {/* Open Tickets Button */}
            <button
              onClick={fetchOpenTickets}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              <Bookmark className="h-4 w-4 text-amber-400" />
              <span>Tickets Abiertos</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* USB Barcode status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400 border border-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Lector USB Activo</span>
            </div>

            {/* Back Office Link */}
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Back Office</span>
            </Link>
          </div>
        </header>

        {/* Search & Categories Bar */}
        <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/50 p-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre, SKU o código de barra..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-slate-800/80 py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-400 outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Categories Pill Selector */}
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map(product => {
              const isOutOfStock = product.track_stock === 1 && product.stock_quantity <= 0;
              const isLowStock = product.track_stock === 1 && product.stock_quantity > 0 && product.stock_quantity <= 5;

              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  disabled={isOutOfStock}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                    isOutOfStock
                      ? 'border-slate-800 bg-slate-900/40 opacity-50 cursor-not-allowed'
                      : 'border-slate-800 bg-slate-900/90 shadow-sm hover:border-slate-700 hover:bg-slate-850 hover:shadow-md'
                  }`}
                  style={{ minHeight: '125px' }}
                >
                  {/* Top Bar with Color Indicator and Stock Badge */}
                  <div className="flex items-start justify-between gap-1 w-full">
                    <div 
                      className="h-2 w-8 rounded-full" 
                      style={{ backgroundColor: product.color || '#10b981' }} 
                    />
                    {product.track_stock === 1 && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        isOutOfStock 
                          ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                          : isLowStock 
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isOutOfStock ? 'Agotado' : `${product.stock_quantity} disp.`}
                      </span>
                    )}
                  </div>

                  {/* Title & SKU */}
                  <div className="my-2 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-emerald-400">
                      {product.name}
                    </h3>
                    {product.sku && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{product.sku}</p>
                    )}
                  </div>

                  {/* Price & Variation Indicator */}
                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-base font-bold text-emerald-400">
                      {formatMoney(product.price)}
                    </span>
                    {(product.variations?.length > 0 || product.modifiers?.length > 0) && (
                      <span className="text-[10px] font-medium text-slate-400">
                        {product.variations?.length ? `${product.variations.length} vars` : '+mods'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <Search className="h-10 w-10 stroke-1 mb-2" />
              <p className="text-sm">No se encontraron productos coincidentes</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: Sticky Cart & Checkout Panel (35% width, min 380px) */}
      <div className="flex w-[380px] lg:w-[420px] flex-col bg-slate-900 border-l border-slate-800 shadow-2xl">
        {/* Cart Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">Ticket Actual</h2>
            {cart.length > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-medium text-rose-400 hover:text-rose-300"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Dining Options & Customer Selectors */}
        <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/60 p-3">
          {/* Dining Options Pills */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1 text-center text-xs">
            {diningOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelectedDiningOption(opt.id)}
                className={`rounded-lg py-1.5 font-medium transition-all ${
                  selectedDiningOption === opt.id
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>

          {/* Customer Selection Row */}
          <div className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <User className="h-4 w-4 text-slate-400" />
              <span>{selectedCustomer ? selectedCustomer.name : 'Cliente General'}</span>
              {selectedCustomer?.points && (
                <span className="text-[10px] text-amber-400">({selectedCustomer.points} pts)</span>
              )}
            </div>
            <select
              value={selectedCustomer?.id || ''}
              onChange={e => {
                const found = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(found || null);
              }}
              className="bg-transparent text-xs text-emerald-400 outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-300">Cambiar cliente</option>
              {customers.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-800/60">
          {cart.map(item => {
            const itemTotal = (item.unitPrice + item.selectedModifiers.reduce((acc, m) => acc + m.price, 0)) * item.quantity;

            return (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-slate-100">{item.productName}</h4>
                  {item.variationName && (
                    <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 mr-1">
                      {item.variationName}
                    </span>
                  )}
                  {item.selectedModifiers.map(m => (
                    <span key={m.optionId} className="inline-block rounded bg-emerald-950/60 text-emerald-300 px-1.5 py-0.5 text-[10px] mr-1">
                      +{m.optionName}
                    </span>
                  ))}
                  <div className="mt-1 text-xs text-slate-400">
                    {formatMoney(item.unitPrice)} c/u
                  </div>
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Item Total & Delete */}
                <div className="flex items-center gap-2 text-right">
                  <span className="text-sm font-bold text-slate-100">
                    {formatMoney(itemTotal)}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center text-slate-500">
              <ShoppingCart className="h-10 w-10 stroke-1 mb-2 text-slate-600" />
              <p className="text-sm">El carrito está vacío</p>
              <p className="text-xs text-slate-600 mt-1">Seleccione productos para empezar</p>
            </div>
          )}
        </div>

        {/* Cart Totals & Checkout Actions */}
        <div className="border-t border-slate-800 bg-slate-900/90 p-4 space-y-3">
          {/* Subtotal, Discounts, Tax lines */}
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-200 font-medium">{formatMoney(subtotalCents)}</span>
            </div>

            {/* Discount selector button/row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-amber-400" />
                <span>Descuento</span>
                <select
                  value={cartDiscount?.id || ''}
                  onChange={e => {
                    const d = discounts.find(item => item.id === e.target.value);
                    setCartDiscount(d || null);
                  }}
                  className="bg-transparent text-emerald-400 outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Ninguno</option>
                  {discounts.map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                      {d.name} ({d.type === 'PERCENTAGE' ? `${d.value}%` : formatMoney(d.value)})
                    </option>
                  ))}
                </select>
              </div>
              {discountCents > 0 && (
                <span className="text-rose-400 font-medium">-{formatMoney(discountCents)}</span>
              )}
            </div>

            <div className="flex justify-between">
              <span>{store?.tax_name || 'IGV'} ({((store?.tax_rate ?? 0.18) * 100).toFixed(0)}% {store?.tax_type === 'INCLUDED' ? 'incluido' : ''})</span>
              <span className="text-slate-300">{formatMoney(taxCents)}</span>
            </div>
          </div>

          {/* Grand Total Display */}
          <div className="flex items-baseline justify-between border-t border-slate-800 pt-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">Total a Pagar</span>
            <span className="text-2xl font-black text-emerald-400">
              {formatMoney(grandTotalCents)}
            </span>
          </div>

          {/* Action Buttons: Hold Ticket & Primary Cobrar */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                if (cart.length === 0) return;
                setShowSaveTicketModal(true);
              }}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <Bookmark className="h-4 w-4 text-amber-400" />
              <span>Guardar</span>
            </button>

            <button
              onClick={startCheckout}
              disabled={cart.length === 0}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-98 disabled:opacity-50 disabled:shadow-none"
            >
              <Banknote className="h-5 w-5" />
              <span>COBRAR {formatMoney(grandTotalCents)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. PRODUCT CUSTOMIZATION MODAL (Variations & Modifiers) */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div>
                <h3 className="text-base font-bold text-white">{showItemModal.name}</h3>
                <p className="text-xs text-slate-400">Seleccione opciones para personalizar</p>
              </div>
              <button 
                onClick={() => setShowItemModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Variations */}
              {showItemModal.variations?.length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tamaño / Variante</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {showItemModal.variations.map((v: any) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariation(v)}
                        className={`flex flex-col rounded-xl border p-2.5 text-left transition-all ${
                          selectedVariation?.id === v.id
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                            : 'border-slate-800 bg-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-sm font-semibold">{v.name}</span>
                        <span className="text-xs text-emerald-400 mt-1">{formatMoney(v.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifiers */}
              {showItemModal.modifiers?.map((mod: any) => (
                <div key={mod.id}>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{mod.name}</label>
                  <div className="mt-2 space-y-1.5">
                    {mod.options?.map((opt: any) => {
                      const isSelected = selectedModOptions[mod.id]?.optionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (isSelected) {
                              const copy = { ...selectedModOptions };
                              delete copy[mod.id];
                              setSelectedModOptions(copy);
                            } else {
                              setSelectedModOptions(prev => ({
                                ...prev,
                                [mod.id]: {
                                  modifierId: mod.id,
                                  modifierName: mod.name,
                                  optionId: opt.id,
                                  optionName: opt.name,
                                  price: opt.price,
                                }
                              }));
                            }
                          }}
                          className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                              : 'border-slate-800 bg-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span>{opt.name}</span>
                          <span className="text-xs text-slate-400">
                            {opt.price > 0 ? `+${formatMoney(opt.price)}` : 'Gratis'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 p-4">
              <button
                onClick={confirmCustomItem}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 transition-colors"
              >
                Agregar al Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/90">
              <div>
                <h3 className="text-base font-bold text-white">Procesar Pago</h3>
                <p className="text-xs text-slate-400">Total a pagar: {formatMoney(grandTotalCents)}</p>
              </div>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Payment Method Tabs */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'CASH', label: 'Efectivo', icon: Banknote },
                  { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
                  { id: 'WALLET', label: 'Yape/Plin', icon: Smartphone },
                  { id: 'OTHER', label: 'Otro', icon: DollarSign },
                ].map(item => {
                  const Icon = item.icon;
                  const active = paymentMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPaymentMethod(item.id as any)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all ${
                        active
                          ? 'border-emerald-500 bg-emerald-950/50 text-emerald-400 shadow'
                          : 'border-slate-800 bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* CASH PAYMENT SECTION */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Efectivo Recibido</label>
                    <span className="text-xs text-emerald-400 font-bold">{store?.currency_symbol || 'S/'}</span>
                  </div>

                  <input
                    type="number"
                    step="0.10"
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-xl font-black text-right text-white outline-none focus:border-emerald-500"
                  />

                  {/* Quick Cash Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setCashTendered((grandTotalCents / 100).toFixed(2))}
                      className="rounded-lg bg-slate-800 p-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      Exacto
                    </button>
                    {[10, 20, 50, 100].map(val => (
                      <button
                        key={val}
                        onClick={() => setCashTendered(val.toFixed(2))}
                        className="rounded-lg bg-slate-800 p-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        S/ {val}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                    <span className="font-semibold text-slate-400">Vuelto (Cambio):</span>
                    <span className={`text-xl font-black ${
                      (parseFloat(cashTendered || '0') * 100) >= grandTotalCents 
                        ? 'text-emerald-400' 
                        : 'text-rose-400'
                    }`}>
                      {formatMoney(Math.max(0, Math.round(parseFloat(cashTendered || '0') * 100) - grandTotalCents))}
                    </span>
                  </div>
                </div>
              )}

              {/* CARD / DIGITAL WALLET REFERENCE */}
              {(paymentMethod === 'CARD' || paymentMethod === 'WALLET') && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    Número de Operación / Referencia (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. OP-123456"
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    {paymentMethod === 'WALLET' ? 'Capture el código de confirmación de Yape o Plin' : 'Procesado a través del terminal POS bancario'}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 p-4">
              <button
                onClick={handleCheckoutSubmit}
                disabled={isProcessingCheckout || (paymentMethod === 'CASH' && (parseFloat(cashTendered || '0') * 100) < grandTotalCents)}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-lg hover:bg-emerald-500 active:scale-98 transition-all disabled:opacity-50"
              >
                {isProcessingCheckout ? 'Procesando...' : `Confirmar y Cobrar ${formatMoney(grandTotalCents)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. THERMAL RECEIPT MODAL */}
      {showReceiptModal && completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[95vh] w-full max-w-sm flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-bold text-white">¡Venta Exitosa!</span>
              </div>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Receipt Paper Container */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 flex justify-center">
              <div id="thermal-receipt" className="w-[300px] bg-white text-black p-4 font-mono text-xs shadow-lg rounded">
                <div className="text-center pb-2 border-b border-black">
                  <h2 className="text-sm font-bold uppercase">{completedOrder.store?.name || 'Cafe Del Parque'}</h2>
                  <p className="text-[10px]">{completedOrder.store?.legal_name}</p>
                  <p className="text-[10px]">RUC: {completedOrder.store?.tax_id}</p>
                  <p className="text-[10px]">{completedOrder.store?.address}</p>
                  <p className="text-[10px]">{completedOrder.store?.phone}</p>
                  <p className="text-xs font-bold mt-1">BOLETA DE VENTA ELECTRÓNICA</p>
                  <p className="text-xs font-semibold">{completedOrder.receipt_number}</p>
                </div>

                <div className="py-2 text-[10px] border-b border-black space-y-0.5">
                  <div className="flex justify-between">
                    <span>Fecha:</span>
                    <span>{new Date(completedOrder.created_at).toLocaleString('es-PE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cajero:</span>
                    <span>{completedOrder.cashier_name}</span>
                  </div>
                  {completedOrder.customer_name && (
                    <div className="flex justify-between">
                      <span>Cliente:</span>
                      <span>{completedOrder.customer_name}</span>
                    </div>
                  )}
                  {completedOrder.dining_option_name && (
                    <div className="flex justify-between">
                      <span>Modalidad:</span>
                      <span>{completedOrder.dining_option_name}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="py-2 border-b border-black space-y-1">
                  {completedOrder.items?.map((item: any) => (
                    <div key={item.id} className="text-[10px]">
                      <div className="flex justify-between font-semibold">
                        <span>{item.quantity} x {item.product_name}</span>
                        <span>{formatMoney(item.total)}</span>
                      </div>
                      {item.variation_name && (
                        <div className="text-[9px] text-gray-600 pl-2">Variante: {item.variation_name}</div>
                      )}
                      {item.selectedModifiers?.map((m: any) => (
                        <div key={m.optionId} className="text-[9px] text-gray-600 pl-2">+{m.optionName}</div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Totals Breakdown */}
                <div className="py-2 border-b border-black text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatMoney(completedOrder.subtotal)}</span>
                  </div>
                  {completedOrder.discount_total > 0 && (
                    <div className="flex justify-between">
                      <span>Descuento:</span>
                      <span>-{formatMoney(completedOrder.discount_total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{completedOrder.store?.tax_name || 'IGV'} (18% inc):</span>
                    <span>{formatMoney(completedOrder.tax_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1">
                    <span>TOTAL:</span>
                    <span>{formatMoney(completedOrder.total)}</span>
                  </div>
                </div>

                {/* Payment info */}
                <div className="py-2 border-b border-black text-[10px] space-y-0.5">
                  {completedOrder.payments?.map((p: any) => (
                    <div key={p.id}>
                      <div className="flex justify-between">
                        <span>Método:</span>
                        <span>{p.payment_method}</span>
                      </div>
                      {p.cash_tendered && (
                        <>
                          <div className="flex justify-between">
                            <span>Recibido:</span>
                            <span>{formatMoney(p.cash_tendered)}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Vuelto:</span>
                            <span>{formatMoney(p.change_due)}</span>
                          </div>
                        </>
                      )}
                      {p.reference_number && (
                        <div className="flex justify-between text-[9px]">
                          <span>Ref:</span>
                          <span>{p.reference_number}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-center pt-3 text-[9px]">
                  <p>{completedOrder.store?.receipt_footer || 'Gracias por su preferencia'}</p>
                  <p className="mt-1">*** COPIA DE CAJA / CLIENTE ***</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-800 p-4">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SHIFT MANAGEMENT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <h3 className="text-base font-bold text-white">Gestión de Turno & Caja</h3>
              <button 
                onClick={() => setShowShiftModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shift Sub-Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950 text-xs font-semibold">
              <button
                onClick={() => setShiftTab('INFO')}
                className={`py-2.5 ${shiftTab === 'INFO' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400'}`}
              >
                Estado
              </button>
              <button
                onClick={() => setShiftTab('PAY_IN_OUT')}
                className={`py-2.5 ${shiftTab === 'PAY_IN_OUT' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400'}`}
              >
                Entrada/Salida
              </button>
              <button
                onClick={() => setShiftTab('CLOSE')}
                className={`py-2.5 ${shiftTab === 'CLOSE' ? 'text-rose-400 border-b-2 border-rose-500' : 'text-slate-400'}`}
              >
                Cerrar Turno
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {shiftTab === 'INFO' && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cajero en Turno:</span>
                      <span className="font-semibold text-white">{currentShift?.user?.name || currentUser?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hora de Apertura:</span>
                      <span className="text-slate-200">{currentShift ? new Date(currentShift.opened_at).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fondo Inicial:</span>
                      <span className="font-semibold text-white">{formatMoney(currentShift?.opening_cash || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold">
                      <span className="text-slate-300">Efectivo Esperado:</span>
                      <span className="text-emerald-400">{formatMoney(currentShift?.expected_cash || 0)}</span>
                    </div>
                  </div>

                  {currentShift?.stats && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-700/50">
                        <span className="text-slate-400">Ventas Totales</span>
                        <div className="text-base font-bold text-white mt-1">
                          {formatMoney(currentShift.stats.total_sales)}
                        </div>
                        <span className="text-[10px] text-slate-500">{currentShift.stats.orders_count} pedidos</span>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-700/50">
                        <span className="text-slate-400">Ventas en Efectivo</span>
                        <div className="text-base font-bold text-emerald-400 mt-1">
                          {formatMoney(currentShift.stats.cash_sales)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {shiftTab === 'PAY_IN_OUT' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCashMovementType('PAY_IN')}
                      className={`rounded-xl py-2 text-xs font-bold ${
                        cashMovementType === 'PAY_IN' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Entrada (Pay In)
                    </button>
                    <button
                      onClick={() => setCashMovementType('PAY_OUT')}
                      className={`rounded-xl py-2 text-xs font-bold ${
                        cashMovementType === 'PAY_OUT' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Salida (Pay Out)
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Monto ({store?.currency_symbol || 'S/'})</label>
                    <input
                      type="number"
                      step="0.50"
                      placeholder="0.00"
                      value={cashMovementAmount}
                      onChange={e => setCashMovementAmount(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-base font-bold text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Motivo</label>
                    <input
                      type="text"
                      placeholder="Ej. Cambio de billetes, compra de insumos"
                      value={cashMovementReason}
                      onChange={e => setCashMovementReason(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    onClick={handleCashMovementSubmit}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Registrar Movimiento
                  </button>
                </div>
              )}

              {shiftTab === 'CLOSE' && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Efectivo Teórico Esperado:</span>
                      <span className="font-bold text-emerald-400">{formatMoney(currentShift?.expected_cash || 0)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Efectivo Real Contado en Gaveta</label>
                    <input
                      type="number"
                      step="0.10"
                      placeholder="0.00"
                      value={actualClosingCash}
                      onChange={e => setActualClosingCash(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-xl font-black text-right text-white outline-none focus:border-rose-500"
                    />
                  </div>

                  {actualClosingCash && (
                    <div className="flex justify-between items-center text-xs font-bold pt-1">
                      <span className="text-slate-400">Diferencia de Caja:</span>
                      <span className={`text-sm ${
                        Math.round(parseFloat(actualClosingCash) * 100) - (currentShift?.expected_cash || 0) === 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {formatMoney(Math.round(parseFloat(actualClosingCash) * 100) - (currentShift?.expected_cash || 0))}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleCloseShiftSubmit}
                    className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-500"
                  >
                    Confirmar Cierre de Turno (Reporte Z)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. OPEN TICKETS MODAL */}
      {showOpenTicketsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <h3 className="text-base font-bold text-white">Tickets en Espera ({openTickets.length})</h3>
              <button 
                onClick={() => setShowOpenTicketsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto">
              {openTickets.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 hover:border-slate-700">
                  <div>
                    <div className="font-bold text-white text-sm">{t.ticket_name || 'Ticket Sin Nombre'}</div>
                    <div className="text-xs text-slate-400">
                      {t.items?.length || 0} productos • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">{formatMoney(t.total)}</span>
                    <button
                      onClick={() => restoreOpenTicket(t)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              ))}

              {openTickets.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No hay tickets guardados actualmente
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. SAVE TICKET MODAL */}
      {showSaveTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Guardar Ticket</h3>
            <input
              type="text"
              placeholder="Ej. Mesa 5, Barra 2, Pedido Juan"
              value={ticketNameInput}
              onChange={e => setTicketNameInput(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-white outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveTicketModal(false)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTicket}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CASHIER PIN PAD MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4 text-center">
            <h3 className="text-base font-bold text-white">Ingresar PIN de Cajero</h3>
            
            {/* PIN Display Dots */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full border border-slate-700 transition-all ${
                    idx < enteredPin.length ? 'bg-emerald-400 scale-110' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {pinError && <p className="text-xs text-rose-400">{pinError}</p>}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      const next = enteredPin + num;
                      setEnteredPin(next);
                      if (next.length === 4) {
                        setTimeout(() => handlePinSubmit(), 100);
                      }
                    }
                  }}
                  className="flex h-14 items-center justify-center rounded-xl bg-slate-800 text-lg font-bold text-white hover:bg-slate-700 active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setEnteredPin('')}
                className="flex h-14 items-center justify-center rounded-xl bg-slate-850 text-xs font-semibold text-rose-400 hover:bg-slate-800"
              >
                C
              </button>
              <button
                onClick={() => {
                  if (enteredPin.length < 4) {
                    const next = enteredPin + '0';
                    setEnteredPin(next);
                    if (next.length === 4) {
                      setTimeout(() => handlePinSubmit(), 100);
                    }
                  }
                }}
                className="flex h-14 items-center justify-center rounded-xl bg-slate-800 text-lg font-bold text-white hover:bg-slate-700 active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => setShowPinModal(false)}
                className="flex h-14 items-center justify-center rounded-xl bg-slate-850 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Salir
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Demo PINs: 1234 (Carlos), 4321 (Mariana), 9999 (Admin)</p>
          </div>
        </div>
      )}
    </div>
  );
}
