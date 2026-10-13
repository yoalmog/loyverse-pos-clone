import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
  FlatList,
  StatusBar
} from 'react-native';

// Product and Cart Interfaces
interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  color: string;
  stock_quantity: number;
  barcode?: string;
  sku?: string;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export default function App() {
  // Navigation Screens: 'PIN' | 'REGISTER' | 'SALES' | 'HISTORY' | 'SHIFT' | 'SETTINGS'
  const [currentScreen, setCurrentScreen] = useState<'PIN' | 'REGISTER' | 'SALES' | 'HISTORY' | 'SHIFT' | 'SETTINGS'>('PIN');
  const [currentEmployee, setCurrentEmployee] = useState<{ id: string; name: string; role: string } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  // Shift & Register
  const [activeShift, setActiveShift] = useState<{ id: string; openingCash: number; expectedCash: number } | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState('200');

  // Network & Sync State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Catalog Demo Data
  const [categories] = useState([
    { id: 'ALL', name: 'Todos' },
    { id: 'cat_coffee', name: 'Café' },
    { id: 'cat_cold', name: 'Fríos' },
    { id: 'cat_bakery', name: 'Panadería' },
    { id: 'cat_sandwiches', name: 'Sandwiches' },
  ]);

  const [products] = useState<Product[]>([
    { id: 'prod_espresso', name: 'Café Espresso', price: 750, category_id: 'cat_coffee', color: '#78350f', stock_quantity: 140, barcode: '7750001001' },
    { id: 'prod_americano', name: 'Café Americano', price: 900, category_id: 'cat_coffee', color: '#92400e', stock_quantity: 190, barcode: '7750001002' },
    { id: 'prod_cappuccino', name: 'Cappuccino Clásico', price: 1200, category_id: 'cat_coffee', color: '#b45309', stock_quantity: 110, barcode: '7750001003' },
    { id: 'prod_orange_juice', name: 'Jugo de Naranja', price: 1100, category_id: 'cat_cold', color: '#f59e0b', stock_quantity: 45, barcode: '7750002001' },
    { id: 'prod_croissant', name: 'Croissant Mantequilla', price: 850, category_id: 'cat_bakery', color: '#d97706', stock_quantity: 25, barcode: '7750003001' },
    { id: 'prod_butifarra', name: 'Butifarra Tradicional', price: 1850, category_id: 'cat_sandwiches', color: '#15803d', stock_quantity: 20, barcode: '7750004001' },
  ]);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDiningOption, setSelectedDiningOption] = useState<'Dine-in' | 'Takeout' | 'Delivery'>('Dine-in');

  // Checkout Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
  const [cashTendered, setCashTendered] = useState('');

  // Receipt Modal
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Sales History
  const [salesHistory, setSalesHistory] = useState<any[]>([]);

  // Format PEN Money
  const formatMoney = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  // PIN Pad Logic
  const handlePinPress = (num: string) => {
    if (enteredPin.length < 4) {
      const next = enteredPin + num;
      setEnteredPin(next);
      if (next.length === 4) {
        if (next === '1234') {
          setCurrentEmployee({ id: 'usr_cashier', name: 'Carlos Mendoza', role: 'CASHIER' });
          setCurrentScreen(activeShift ? 'SALES' : 'REGISTER');
          setEnteredPin('');
        } else if (next === '9999') {
          setCurrentEmployee({ id: 'usr_admin', name: 'Admin General', role: 'ADMIN' });
          setCurrentScreen(activeShift ? 'SALES' : 'REGISTER');
          setEnteredPin('');
        } else {
          Alert.alert('Error', 'PIN incorrecto. (Demo PIN: 1234)');
          setEnteredPin('');
        }
      }
    }
  };

  // Start Shift
  const handleOpenShift = () => {
    const openingCents = Math.round(parseFloat(openingCashInput || '0') * 100);
    setActiveShift({
      id: `shift_${Date.now()}`,
      openingCash: openingCents,
      expectedCash: openingCents,
    });
    setCurrentScreen('SALES');
  };

  // Add to cart
  const addToCart = (product: Product) => {
    setCart(prev => {
      const found = prev.find(item => item.productId === product.id);
      if (found) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: `ci_${Date.now()}_${product.id}`, productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const next = item.quantity + delta;
        return next > 0 ? { ...item, quantity: next } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  // Calculations
  const { subtotalCents, taxCents, grandTotalCents } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const tax = Math.round(sub - (sub / 1.18)); // IGV 18% included
    return { subtotalCents: sub, taxCents: tax, grandTotalCents: sub };
  }, [cart]);

  // Execute Checkout
  const handleConfirmCheckout = () => {
    const tenderedCents = paymentMethod === 'CASH' ? Math.round(parseFloat(cashTendered || '0') * 100) : grandTotalCents;
    if (tenderedCents < grandTotalCents) {
      Alert.alert('Error', 'Monto recibido es menor al total');
      return;
    }

    const newOrder = {
      id: `ord_${Date.now()}`,
      receiptNumber: `REC-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleTimeString(),
      items: [...cart],
      total: grandTotalCents,
      paymentMethod,
      cashTendered: tenderedCents,
      changeDue: tenderedCents - grandTotalCents,
      diningOption: selectedDiningOption,
      cashier: currentEmployee?.name,
      synced: isOnline,
    };

    if (!isOnline) {
      setOfflineQueueCount(prev => prev + 1);
    }

    if (activeShift && paymentMethod === 'CASH') {
      setActiveShift({ ...activeShift, expectedCash: activeShift.expectedCash + grandTotalCents });
    }

    setSalesHistory(prev => [newOrder, ...prev]);
    setCompletedOrder(newOrder);
    setCart([]);
    setShowCheckoutModal(false);
    setShowReceiptModal(true);
  };

  // Refund Order
  const handleRefund = (orderId: string) => {
    Alert.alert('Confirmar Reembolso', '¿Desea reembolsar esta venta y restaurar el inventario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reembolsar',
        style: 'destructive',
        onPress: () => {
          setSalesHistory(prev => prev.map(o => o.id === orderId ? { ...o, refunded: true } : o));
          Alert.alert('Éxito', 'Venta reembolsada correctamente');
        }
      }
    ]);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const matchQuery = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.includes(searchQuery);
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* SCREEN 1: PIN ACCESS SCREEN */}
      {currentScreen === 'PIN' && (
        <View style={styles.pinContainer}>
          <Text style={styles.pinTitle}>LOYVERSE POS ANDROID</Text>
          <Text style={styles.pinSubtitle}>Ingrese PIN de Cajero (Demo: 1234)</Text>
          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3].map(idx => (
              <View
                key={idx}
                style={[styles.pinDot, idx < enteredPin.length && styles.pinDotFilled]}
              />
            ))}
          </View>
          <View style={styles.keypadGrid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.keypadButton}
                onPress={() => {
                  if (key === 'C') setEnteredPin('');
                  else if (key === 'OK') {
                    if (enteredPin === '1234' || enteredPin === '9999') handlePinPress('');
                  } else handlePinPress(key);
                }}
              >
                <Text style={styles.keypadButtonText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* SCREEN 2: REGISTER & SHIFT OPENING */}
      {currentScreen === 'REGISTER' && (
        <View style={styles.shiftOpenContainer}>
          <Text style={styles.modalTitle}>Apertura de Caja & Turno</Text>
          <Text style={styles.label}>Fondo Inicial de Caja (S/):</Text>
          <TextInput
            style={styles.inputLarge}
            keyboardType="numeric"
            value={openingCashInput}
            onChangeText={setOpeningCashInput}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleOpenShift}>
            <Text style={styles.btnText}>Abrir Turno de Venta</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SCREEN 3: SALES SCREEN (MAIN LANDSCAPE TABLET POS) */}
      {currentScreen === 'SALES' && (
        <View style={styles.mainLayout}>
          {/* LEFT: Product Catalog & Category Nav (65%) */}
          <View style={styles.leftCatalog}>
            {/* Top Toolbar */}
            <View style={styles.topToolbar}>
              <View style={styles.userBadge}>
                <Text style={styles.userBadgeText}>{currentEmployee?.name}</Text>
              </View>
              <View style={styles.statusRow}>
                <TouchableOpacity
                  style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}
                  onPress={() => setIsOnline(!isOnline)}
                >
                  <Text style={styles.badgeText}>{isOnline ? 'Online' : 'Offline'}</Text>
                </TouchableOpacity>
                {offlineQueueCount > 0 && (
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncBadgeText}>{offlineQueueCount} pendientes</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setCurrentScreen('HISTORY')}
                >
                  <Text style={styles.navBtnText}>Historial</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setCurrentScreen('PIN')}
                >
                  <Text style={styles.navBtnText}>Bloquear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Box */}
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o código de barra..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, selectedCategory === cat.id && styles.catPillActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[styles.catPillText, selectedCategory === cat.id && styles.catPillTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Product Grid */}
            <FlatList
              data={filteredProducts}
              numColumns={3}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.productCard, { borderColor: item.color }]}
                  onPress={() => addToCart(item)}
                >
                  <View style={[styles.colorBar, { backgroundColor: item.color }]} />
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.productPrice}>{formatMoney(item.price)}</Text>
                  <Text style={styles.stockText}>{item.stock_quantity} disp.</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* RIGHT: Cart Panel & Checkout (35%) */}
          <View style={styles.rightCart}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Ticket Actual</Text>
              {cart.length > 0 && (
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text style={styles.clearText}>Vaciar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Dining Options */}
            <View style={styles.diningRow}>
              {(['Dine-in', 'Takeout', 'Delivery'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.diningBtn, selectedDiningOption === opt && styles.diningBtnActive]}
                  onPress={() => setSelectedDiningOption(opt)}
                >
                  <Text style={[styles.diningBtnText, selectedDiningOption === opt && styles.diningBtnTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cart Items List */}
            <ScrollView style={styles.cartList}>
              {cart.map(item => (
                <View key={item.id} style={styles.cartItemRow}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>{formatMoney(item.price)} c/u</Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => updateQuantity(item.productId, -1)}>
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => updateQuantity(item.productId, 1)}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemTotal}>{formatMoney(item.price * item.quantity)}</Text>
                </View>
              ))}
              {cart.length === 0 && (
                <Text style={styles.emptyCartText}>El carrito está vacío</Text>
              )}
            </ScrollView>

            {/* Cart Footer & Totals */}
            <View style={styles.cartFooter}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatMoney(subtotalCents)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>IGV (18% incluido)</Text>
                <Text style={styles.totalValue}>{formatMoney(taxCents)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                <Text style={styles.grandTotalValue}>{formatMoney(grandTotalCents)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btnCheckout, cart.length === 0 && styles.btnDisabled]}
                disabled={cart.length === 0}
                onPress={() => {
                  setCashTendered((grandTotalCents / 100).toFixed(2));
                  setShowCheckoutModal(true);
                }}
              >
                <Text style={styles.btnCheckoutText}>COBRAR {formatMoney(grandTotalCents)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* SCREEN 4: HISTORY & REFUNDS */}
      {currentScreen === 'HISTORY' && (
        <View style={styles.historyContainer}>
          <View style={styles.topToolbar}>
            <Text style={styles.modalTitle}>Historial de Ventas</Text>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setCurrentScreen('SALES')}>
              <Text style={styles.btnSecondaryText}>Volver a Ventas</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={salesHistory}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <View>
                  <Text style={styles.historyReceipt}>{item.receiptNumber}</Text>
                  <Text style={styles.historyTime}>{item.date} • {item.paymentMethod}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyTotal}>{formatMoney(item.total)}</Text>
                  {item.refunded ? (
                    <Text style={styles.refundBadge}>REEMBOLSADO</Text>
                  ) : (
                    <TouchableOpacity style={styles.btnRefund} onPress={() => handleRefund(item.id)}>
                      <Text style={styles.btnRefundText}>Reembolsar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* CHECKOUT MODAL */}
      <Modal visible={showCheckoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Seleccionar Forma de Pago</Text>
            <View style={styles.payMethodsRow}>
              {(['CASH', 'CARD', 'WALLET'] as const).map(method => (
                <TouchableOpacity
                  key={method}
                  style={[styles.payMethodBtn, paymentMethod === method && styles.payMethodBtnActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[styles.payMethodText, paymentMethod === method && styles.payMethodTextActive]}>
                    {method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : 'Yape/Plin'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'CASH' && (
              <View style={styles.cashSection}>
                <Text style={styles.label}>Monto Recibido (S/):</Text>
                <TextInput
                  style={styles.inputLarge}
                  keyboardType="numeric"
                  value={cashTendered}
                  onChangeText={setCashTendered}
                />
                <Text style={styles.changeText}>
                  Vuelto: {formatMoney(Math.max(0, Math.round(parseFloat(cashTendered || '0') * 100) - grandTotalCents))}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCheckoutModal(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirmCheckout}>
                <Text style={styles.btnConfirmText}>Confirmar Pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* THERMAL RECEIPT MODAL */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptPaper}>
            <Text style={styles.receiptHeader}>CAFE DEL PARQUE</Text>
            <Text style={styles.receiptSub}>RUC: 20601234567</Text>
            <Text style={styles.receiptSub}>BOLETA DE VENTA ELECTRÓNICA</Text>
            <Text style={styles.receiptSub}>{completedOrder?.receiptNumber}</Text>
            <View style={styles.receiptDivider} />
            {completedOrder?.items?.map((it: any) => (
              <View key={it.id} style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>{it.quantity}x {it.name}</Text>
                <Text style={styles.receiptItemPrice}>{formatMoney(it.price * it.quantity)}</Text>
              </View>
            ))}
            <View style={styles.receiptDivider} />
            <View style={styles.receiptItemRow}>
              <Text style={styles.receiptBold}>TOTAL:</Text>
              <Text style={styles.receiptBold}>{formatMoney(completedOrder?.total || 0)}</Text>
            </View>
            <Text style={styles.receiptFooter}>¡Gracias por su compra!</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.btnText}>Nueva Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  pinTitle: { fontSize: 24, fontWeight: '900', color: '#10b981', letterSpacing: 1 },
  pinSubtitle: { fontSize: 13, color: '#94a3b8', marginVertical: 12 },
  pinDotsRow: { flexDirection: 'row', gap: 14, marginVertical: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  pinDotFilled: { backgroundColor: '#10b981' },
  keypadGrid: { width: 280, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  keypadButton: { width: 75, height: 75, borderRadius: 16, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  keypadButtonText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },

  shiftOpenContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  inputLarge: { width: '80%', height: 60, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, fontSize: 26, fontWeight: 'bold', color: '#10b981', textAlign: 'center', marginVertical: 16 },

  mainLayout: { flex: 1, flexDirection: 'row' },
  leftCatalog: { flex: 65, borderRightWidth: 1, borderColor: '#1e293b', padding: 12 },
  rightCart: { flex: 35, backgroundColor: '#0f172a', padding: 12, justifyContent: 'space-between' },

  topToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userBadge: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  userBadgeText: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 12 },
  statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeOnline: { backgroundColor: '#064e3b' },
  badgeOffline: { backgroundColor: '#7f1d1d' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  syncBadge: { backgroundColor: '#78350f', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  syncBadgeText: { color: '#fef08a', fontSize: 10, fontWeight: 'bold' },
  navBtn: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  navBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },

  searchInput: { height: 42, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 12, color: '#fff', fontSize: 13, marginBottom: 8 },
  categoryScroll: { maxHeight: 42, marginBottom: 8 },
  catPill: { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  catPillActive: { backgroundColor: '#10b981' },
  catPillText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  catPillTextActive: { color: '#fff' },

  gridContent: { paddingBottom: 20 },
  productCard: { flex: 1, minWidth: '30%', backgroundColor: '#0f172a', borderWidth: 1, borderRadius: 12, padding: 10, margin: 4, minHeight: 95 },
  colorBar: { height: 4, width: 24, borderRadius: 2, marginBottom: 6 },
  productName: { color: '#fff', fontSize: 12, fontWeight: 'bold', minHeight: 32 },
  productPrice: { color: '#10b981', fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  stockText: { color: '#64748b', fontSize: 10, marginTop: 2 },

  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#1e293b', paddingBottom: 8 },
  cartTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  clearText: { color: '#f43f5e', fontSize: 12 },
  diningRow: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  diningBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  diningBtnActive: { backgroundColor: '#10b981' },
  diningBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  diningBtnTextActive: { color: '#fff' },

  cartList: { flex: 1, marginVertical: 6 },
  cartItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#1e293b' },
  cartItemInfo: { flex: 1 },
  cartItemName: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cartItemPrice: { color: '#94a3b8', fontSize: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 4 },
  stepBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  stepBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  qtyText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginHorizontal: 6 },
  itemTotal: { color: '#fff', fontSize: 12, fontWeight: 'bold', width: 65, textAlign: 'right' },
  emptyCartText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 13 },

  cartFooter: { borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  totalLabel: { color: '#94a3b8', fontSize: 11 },
  totalValue: { color: '#e2e8f0', fontSize: 11, fontWeight: '600' },
  grandTotalRow: { marginVertical: 6, paddingTop: 4, borderTopWidth: 1, borderColor: '#334155' },
  grandTotalLabel: { color: '#fff', fontSize: 14, fontWeight: '900' },
  grandTotalValue: { color: '#10b981', fontSize: 18, fontWeight: '900' },

  btnCheckout: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  btnCheckoutText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.4 },

  historyContainer: { flex: 1, padding: 16 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8 },
  historyReceipt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  historyTime: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: { color: '#10b981', fontWeight: 'bold', fontSize: 14 },
  btnRefund: { backgroundColor: '#7f1d1d', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  btnRefundText: { color: '#fca5a5', fontSize: 10, fontWeight: 'bold' },
  refundBadge: { color: '#f43f5e', fontSize: 10, fontWeight: 'bold', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: 420, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 14 },
  payMethodsRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  payMethodBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  payMethodBtnActive: { backgroundColor: '#064e3b', borderWidth: 1, borderColor: '#10b981' },
  payMethodText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 12 },
  payMethodTextActive: { color: '#10b981' },
  cashSection: { marginVertical: 10 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  changeText: { color: '#10b981', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 6 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnCancel: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnCancelText: { color: '#94a3b8', fontWeight: 'bold' },
  btnConfirm: { flex: 1, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnConfirmText: { color: '#fff', fontWeight: 'bold' },

  receiptPaper: { width: 300, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  receiptHeader: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#000' },
  receiptSub: { fontSize: 10, textAlign: 'center', color: '#333' },
  receiptDivider: { height: 1, backgroundColor: '#ccc', marginVertical: 8 },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptItemName: { fontSize: 11, color: '#000' },
  receiptItemPrice: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  receiptBold: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  receiptFooter: { fontSize: 10, textAlign: 'center', marginVertical: 10, color: '#555' },
  btnPrimary: { backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnSecondaryText: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
});
