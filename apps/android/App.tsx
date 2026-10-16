import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  StatusBar,
  ActivityIndicator,
  Image
} from 'react-native';
import { posApi, getBaseApiUrl, setBaseApiUrl, DEFAULT_API_URL } from './api';
import { storage } from './storage';

// Product, Category, and Cart Types
interface Product {
  id: string;
  name: string;
  price: number; // cents
  category_id?: string | null;
  color?: string;
  stock_quantity: number;
  barcode?: string;
  sku?: string;
  image_url?: string | null;
  variations?: any[];
  modifiers?: any[];
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface CartItem {
  id: string;
  productId: string;
  variationId?: string | null;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: any[];
}

export default function App() {
  // Screens: 'PIN' | 'REGISTER' | 'SALES' | 'HISTORY' | 'SETTINGS'
  const [currentScreen, setCurrentScreen] = useState<'PIN' | 'REGISTER' | 'SALES' | 'HISTORY' | 'SETTINGS'>('PIN');
  const [currentEmployee, setCurrentEmployee] = useState<{ id: string; name: string; role: string } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  // API Config & Connection State
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<string | null>(null);

  // Shift & Register
  const [activeShift, setActiveShift] = useState<{ id: string; opening_cash: number; expected_cash: number } | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState('200');
  const [closingCashInput, setClosingCashInput] = useState('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);

  // Catalog State
  const [categories, setCategories] = useState<Category[]>([
    { id: 'ALL', name: 'Todos' },
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Open Tickets (Park Cart & Recall)
  const [openTickets, setOpenTickets] = useState<any[]>([]);
  const [showOpenTicketsModal, setShowOpenTicketsModal] = useState(false);
  const [showSaveTicketModal, setShowSaveTicketModal] = useState(false);
  const [ticketNameInput, setTicketNameInput] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDiningOption, setSelectedDiningOption] = useState<'Dine-in' | 'Takeout' | 'Delivery'>('Dine-in');

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH');
  const [cashTenderedInput, setCashTenderedInput] = useState('');
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Receipt Modal State
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Sales History State
  const [salesHistory, setSalesHistory] = useState<any[]>([]);

  // Format PEN Currency
  const formatMoney = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  // 1. Initial Load: API URL, Catalog & Offline Queue Count
  const loadInitialData = useCallback(async () => {
    try {
      const url = await getBaseApiUrl();
      setApiUrl(url);

      setIsLoadingCatalog(true);
      const { data, fromCache } = await posApi.getCatalog();
      setIsOnline(!fromCache);

      if (data) {
        if (data.categories) {
          setCategories([{ id: 'ALL', name: 'Todos' }, ...data.categories]);
        }
        if (data.products) {
          setProducts(data.products);
        }
        if (data.cashiers) {
          setCashiers(data.cashiers);
        }
        if (data.customers) {
          setCustomers(data.customers);
        }
        if (data.currentShift) {
          setActiveShift(data.currentShift);
        }
      }

      // Check open tickets
      try {
        const tickets = await posApi.getOpenTickets();
        setOpenTickets(tickets);
      } catch {}

      // Check offline queue
      const queue = await posApi.getOfflineQueue();
      setOfflineQueueCount(queue.filter(e => e.status !== 'SYNCED').length);
    } catch (err) {
      console.warn('[App] Load error:', err);
      setIsOnline(false);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);


  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. PIN Pad Logic with Server Authentication
  const handlePinPress = async (num: string) => {
    if (enteredPin.length < 4) {
      const next = enteredPin + num;
      setEnteredPin(next);

      if (next.length === 4) {
        try {
          const authRes = await posApi.authenticatePin(next);
          if (authRes.success && authRes.user) {
            setCurrentEmployee(authRes.user);
            setEnteredPin('');
            setCurrentScreen(activeShift ? 'SALES' : 'REGISTER');
            return;
          }
        } catch {
          // Fall through to local fallback
        }

        // Local offline fallback for demo PINs
        if (next === '1234') {
          setCurrentEmployee({ id: 'usr_cashier', name: 'Carlos Mendoza', role: 'CASHIER' });
          setEnteredPin('');
          setCurrentScreen(activeShift ? 'SALES' : 'REGISTER');
        } else if (next === '9999') {
          setCurrentEmployee({ id: 'usr_admin', name: 'Administrador', role: 'ADMIN' });
          setEnteredPin('');
          setCurrentScreen(activeShift ? 'SALES' : 'REGISTER');
        } else {
          Alert.alert('Acceso Denegado', 'PIN incorrecto. (PINs válidos: 1234 o 9999)');
          setEnteredPin('');
        }
      }
    }
  };

  // 3. Shift Opening via API or Local Fallback
  const handleOpenShift = async () => {
    const openingCents = Math.round(parseFloat(openingCashInput || '0') * 100);
    try {
      if (currentEmployee) {
        const shiftData = await posApi.openShift(currentEmployee.id, openingCents);
        setActiveShift(shiftData);
      }
    } catch (err: any) {
      console.warn('[Shift] API openShift error, using local fallback:', err.message);
      setActiveShift({
        id: `shift_${Date.now()}`,
        opening_cash: openingCents,
        expected_cash: openingCents,
      });
    }
    setCurrentScreen('SALES');
  };

  // 4. Cart Add / Stepper
  const addToCart = (product: Product) => {
    setCart(prev => {
      const found = prev.find(item => item.productId === product.id);
      if (found) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...prev,
        {
          id: `ci_${Date.now()}_${product.id}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          selectedModifiers: [],
        }
      ];
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

  // 5. Barcode Scanner Keyboard Handler
  const handleBarcodeSubmit = () => {
    if (!barcodeInput.trim()) return;
    const code = barcodeInput.trim();
    const found = products.find(p => p.barcode === code || p.sku === code);
    if (found) {
      addToCart(found);
      setBarcodeInput('');
    } else {
      Alert.alert('No encontrado', `No se encontró producto con código: ${code}`);
    }
  };

  // 6. Autoritative Minor-Unit Calculations
  const { subtotalCents, taxCents, grandTotalCents } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    // IGV 18% included
    const tax = Math.round(sub - (sub / 1.18));
    return { subtotalCents: sub, taxCents: tax, grandTotalCents: sub };
  }, [cart]);

  // 7. Atomic Checkout Execution (Direct API or Persistent Offline Queue)
  const handleConfirmCheckout = async () => {
    if (cart.length === 0) return;

    const tenderedCents = paymentMethod === 'CASH'
      ? Math.round(parseFloat(cashTenderedInput || '0') * 100)
      : grandTotalCents;

    if (paymentMethod === 'CASH' && tenderedCents < grandTotalCents) {
      Alert.alert('Monto Insuficiente', `Monto recibido (${formatMoney(tenderedCents)}) es menor al total (${formatMoney(grandTotalCents)})`);
      return;
    }

    const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const checkoutPayload = {
      idempotencyKey,
      userId: currentEmployee?.id || 'usr_cashier',
      shiftId: activeShift?.id || null,
      customerId: selectedCustomer?.id || null,
      paymentMethod,
      cashTendered: tenderedCents,
      items: cart.map(item => ({
        productId: item.productId,
        variationId: item.variationId || null,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        selectedModifiers: item.selectedModifiers,
      })),
      orderNote: `Pedido desde POS Android (${selectedDiningOption})${selectedCustomer ? ` • Cliente: ${selectedCustomer.name}` : ''}`,
    };

    setIsSubmittingCheckout(true);

    try {
      const { order, isOffline: wasOffline } = await posApi.checkout(checkoutPayload);

      // Add to sales history
      setSalesHistory(prev => [order, ...prev]);
      setCompletedOrder(order);

      // If recorded offline, increment badge count
      if (wasOffline) {
        setOfflineQueueCount(prev => prev + 1);
        setIsOnline(false);
      }

      // Update shift cash if cash payment
      if (activeShift && paymentMethod === 'CASH') {
        setActiveShift({
          ...activeShift,
          expected_cash: (activeShift.expected_cash || 0) + grandTotalCents,
        });
      }

      setCart([]);
      setSelectedCustomer(null);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
    } catch (err: any) {
      Alert.alert('Error de Cobro', err.message || 'No se pudo procesar la venta');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  // 7a. Save Open Ticket (Park Cart)
  const handleSaveTicket = async () => {
    if (cart.length === 0) return;
    const name = ticketNameInput.trim() || `Ticket ${Date.now().toString().slice(-4)}`;
    try {
      await posApi.saveOpenTicket({
        ticketName: name,
        userId: currentEmployee?.id || 'usr_cashier',
        shiftId: activeShift?.id || null,
        customerId: selectedCustomer?.id || null,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          selectedModifiers: item.selectedModifiers,
        })),
        orderNote: `Guardado desde POS Android (${selectedDiningOption})`,
      });
      setCart([]);
      setSelectedCustomer(null);
      setShowSaveTicketModal(false);
      Alert.alert('Ticket Guardado', `"${name}" se guardó como ticket abierto.`);
      const fresh = await posApi.getOpenTickets();
      setOpenTickets(fresh);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el ticket');
    }
  };

  // 7b. Recall Open Ticket
  const handleRecallTicket = (ticket: any) => {
    const applyTicket = async () => {
      const restoredItems: CartItem[] = (ticket.items || []).map((it: any) => ({
        id: `ci_${Date.now()}_${it.product_id || it.productId}`,
        productId: it.product_id || it.productId,
        name: it.product_name || it.name,
        price: it.unit_price || it.price,
        quantity: it.quantity || 1,
        selectedModifiers: it.selected_modifiers || it.selectedModifiers || [],
      }));
      setCart(restoredItems);
      if (ticket.customer_id) {
        const cust = customers.find(c => c.id === ticket.customer_id);
        if (cust) setSelectedCustomer(cust);
      }
      setShowOpenTicketsModal(false);
      try {
        await posApi.deleteOpenTicket(ticket.id);
        const fresh = await posApi.getOpenTickets();
        setOpenTickets(fresh);
      } catch {}
      Alert.alert('Ticket Recuperado', `Se cargó "${ticket.ticket_name || ticket.id}" en el terminal.`);
    };

    if (cart.length > 0) {
      Alert.alert(
        'Reemplazar Ticket Actual',
        'Hay productos en el ticket actual. ¿Desea reemplazarlos con este ticket abierto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reemplazar', onPress: applyTicket }
        ]
      );
    } else {
      applyTicket();
    }
  };

  // 7c. Shift Close
  const handleCloseShift = async () => {
    if (!activeShift) return;
    const closingCents = Math.round(parseFloat(closingCashInput || '0') * 100);
    setIsClosingShift(true);
    try {
      await posApi.closeShift(activeShift.id, closingCents);
      setActiveShift(null);
      setShowShiftModal(false);
      Alert.alert('Turno Cerrado', `El turno fue cerrado exitosamente con ${formatMoney(closingCents)} en caja.`);
      setCurrentScreen('PIN');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cerrar el turno');
    } finally {
      setIsClosingShift(false);
    }
  };


  // 8. Manual Sync Queue Trigger
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const { syncedCount, failedCount } = await posApi.flushOfflineQueue();
      const queue = await posApi.getOfflineQueue();
      const remainingCount = queue.filter(e => e.status !== 'SYNCED').length;
      setOfflineQueueCount(remainingCount);

      if (syncedCount > 0) {
        setIsOnline(true);
        Alert.alert('Sincronización Exitosa', `${syncedCount} venta(s) sincronizadas con el servidor.`);
        // Reload catalog to get fresh inventory
        const { data } = await posApi.getCatalog();
        if (data?.products) setProducts(data.products);
      } else if (failedCount > 0) {
        Alert.alert('Aviso', `Hubo fallas al sincronizar. Quedan ${remainingCount} pendientes.`);
      } else {
        Alert.alert('Al Día', 'No hay ventas pendientes de sincronizar.');
      }
    } catch (err: any) {
      Alert.alert('Error de Red', 'El servidor no está disponible para sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 9. Refund Workflow
  const handleRefund = async (order: any) => {
    Alert.alert(
      'Confirmar Reembolso',
      `¿Desea reembolsar el ticket ${order.receipt_number || order.receiptNumber} (${formatMoney(order.total)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reembolsar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (order.id && !order.is_offline) {
                await posApi.refundOrder(order.id, currentEmployee?.id || 'usr_cashier', 'Devolución solicitada por cliente');
              }
              setSalesHistory(prev => prev.map(o => o.id === order.id ? { ...o, status: 'REFUNDED', refunded: true } : o));
              Alert.alert('Éxito', 'Venta reembolsada e inventario restaurado.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo procesar el reembolso');
            }
          }
        }
      ]
    );
  };

  // Filtered Catalog
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const matchQuery = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
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
          <Text style={styles.pinSubtitle}>Ingrese PIN de Cajero (PINs: 1234 / 9999)</Text>
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
                    if (enteredPin.length === 4) handlePinPress('');
                  } else handlePinPress(key);
                }}
              >
                <Text style={styles.keypadButtonText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.linkSettings}
            onPress={() => setCurrentScreen('SETTINGS')}
          >
            <Text style={styles.linkSettingsText}>⚙ Ajustes de Servidor / Red</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SCREEN 2: SHIFT OPENING */}
      {currentScreen === 'REGISTER' && (
        <View style={styles.shiftOpenContainer}>
          <Text style={styles.modalTitle}>Apertura de Caja & Turno</Text>
          <Text style={styles.shiftSubText}>Cajero: {currentEmployee?.name} ({currentEmployee?.role})</Text>
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

      {/* SCREEN 3: MAIN SALES SCREEN (TOUCH POS LANDSCAPE) */}
      {currentScreen === 'SALES' && (
        <View style={styles.mainLayout}>
          {/* LEFT PANEL: Catalog & Search (65%) */}
          <View style={styles.leftCatalog}>
            {/* Top Bar */}
            <View style={styles.topToolbar}>
              <View style={styles.userBadge}>
                <Text style={styles.userBadgeText}>👤 {currentEmployee?.name}</Text>
              </View>

              <View style={styles.statusRow}>
                {/* Network Status Badge */}
                <TouchableOpacity
                  style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}
                  onPress={() => setIsOnline(!isOnline)}
                >
                  <Text style={styles.badgeText}>{isOnline ? '● Online' : '○ Offline'}</Text>
                </TouchableOpacity>

                {/* Offline Queue Badge */}
                {offlineQueueCount > 0 && (
                  <TouchableOpacity
                    style={styles.syncBadge}
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#fef08a" />
                    ) : (
                      <Text style={styles.syncBadgeText}>⚡ {offlineQueueCount} pendientes (Sincronizar)</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.navBtn, openTickets.length > 0 && { backgroundColor: '#1e3a5f' }]}
                  onPress={async () => {
                    try {
                      const fresh = await posApi.getOpenTickets();
                      setOpenTickets(fresh);
                    } catch {}
                    setShowOpenTicketsModal(true);
                  }}
                >
                  <Text style={[styles.navBtnText, openTickets.length > 0 && { color: '#60a5fa' }]}>
                    📋 Tickets {openTickets.length > 0 ? `(${openTickets.length})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => {
                    setClosingCashInput(activeShift ? (activeShift.expected_cash / 100).toFixed(2) : '0.00');
                    setShowShiftModal(true);
                  }}
                >
                  <Text style={styles.navBtnText}>💰 Turno</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentScreen('HISTORY')}>
                  <Text style={styles.navBtnText}>Historial</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentScreen('SETTINGS')}>
                  <Text style={styles.navBtnText}>Ajustes</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navBtnLock} onPress={() => setCurrentScreen('PIN')}>
                  <Text style={styles.navBtnText}>Bloquear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Barcode & Search Controls */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre o descripción..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TextInput
                style={styles.barcodeInput}
                placeholder="Escanear Código..."
                placeholderTextColor="#94a3b8"
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={handleBarcodeSubmit}
              />
            </View>

            {/* Category Filter Tabs */}
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
            {isLoadingCatalog ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Cargando catálogo del servidor...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredProducts}
                numColumns={3}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.gridContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.productCard, { borderColor: item.color || '#334155' }]}
                    onPress={() => addToCart(item)}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.productImage} />
                    ) : (
                      <View style={[styles.colorBar, { backgroundColor: item.color || '#10b981' }]} />
                    )}
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productPrice}>{formatMoney(item.price)}</Text>
                    <Text style={styles.stockText}>Stock: {item.stock_quantity}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* RIGHT PANEL: Cart & Totals (35%) */}
          <View style={styles.rightCart}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Ticket Actual ({cart.reduce((a, b) => a + b.quantity, 0)})</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {cart.length > 0 && (
                  <TouchableOpacity
                    style={styles.parkBtn}
                    onPress={() => {
                      setTicketNameInput(`Mesa ${openTickets.length + 1}`);
                      setShowSaveTicketModal(true);
                    }}
                  >
                    <Text style={styles.parkBtnText}>⏸ Guardar</Text>
                  </TouchableOpacity>
                )}
                {cart.length > 0 && (
                  <TouchableOpacity onPress={() => setCart([])}>
                    <Text style={styles.clearText}>Vaciar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Customer Attachment Bar */}
            <TouchableOpacity
              style={styles.customerBar}
              onPress={() => setShowCustomerModal(true)}
            >
              <Text style={styles.customerBarText}>
                {selectedCustomer ? `👤 ${selectedCustomer.name} (${selectedCustomer.loyalty_points || 0} pts)` : '+ Agregar Cliente'}
              </Text>
              {selectedCustomer && (
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={styles.removeCustomerText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Dining Options */}
            <View style={styles.diningRow}>
              {(['Dine-in', 'Takeout', 'Delivery'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.diningBtn, selectedDiningOption === opt && styles.diningBtnActive]}
                  onPress={() => setSelectedDiningOption(opt)}
                >
                  <Text style={[styles.diningBtnText, selectedDiningOption === opt && styles.diningBtnTextActive]}>
                    {opt === 'Dine-in' ? 'Mesa' : opt === 'Takeout' ? 'Llevar' : 'Delivery'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cart Item Rows */}
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
                <Text style={styles.emptyCartText}>Toque un producto para agregar al pedido</Text>
              )}
            </ScrollView>

            {/* Summary & Checkout Action */}
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
                  setCashTenderedInput((grandTotalCents / 100).toFixed(2));
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
              <Text style={styles.btnSecondaryText}>← Volver al Terminal</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={salesHistory}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <View>
                  <Text style={styles.historyReceipt}>
                    {item.receipt_number || item.receiptNumber}
                    {item.is_offline ? ' [OFFLINE]' : ''}
                  </Text>
                  <Text style={styles.historyTime}>
                    {new Date(item.created_at || Date.now()).toLocaleTimeString()} • {item.payments?.[0]?.payment_method || item.paymentMethod || 'CASH'}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyTotal}>{formatMoney(item.total)}</Text>
                  {item.status === 'REFUNDED' || item.refunded ? (
                    <Text style={styles.refundBadge}>REEMBOLSADO</Text>
                  ) : (
                    <TouchableOpacity style={styles.btnRefund} onPress={() => handleRefund(item)}>
                      <Text style={styles.btnRefundText}>Reembolsar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyCartText}>No hay ventas registradas en esta sesión.</Text>
            }
          />
        </View>
      )}

      {/* SCREEN 5: SETTINGS & NETWORK CONFIG */}
      {currentScreen === 'SETTINGS' && (
        <View style={styles.shiftOpenContainer}>
          <Text style={styles.modalTitle}>Ajustes de Servidor & Conectividad</Text>
          <Text style={styles.label}>URL Base de la API:</Text>
          <TextInput
            style={styles.inputUrl}
            value={apiUrl}
            onChangeText={(txt) => {
              setApiUrl(txt);
              setConnStatus(null);
            }}
            placeholder="http://192.168.1.50:3001 o https://mi-pos.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.quickUrlRow}>
            <TouchableOpacity
              style={styles.btnSmall}
              onPress={() => {
                setApiUrl('http://192.168.1.50:3001');
                setConnStatus(null);
              }}
            >
              <Text style={styles.btnSmallText}>Wi-Fi LAN (192.168.1.50)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSmall}
              onPress={() => {
                setApiUrl('http://localhost:3001');
                setConnStatus(null);
              }}
            >
              <Text style={styles.btnSmallText}>USB / ADB (localhost:3001)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSmall}
              onPress={() => {
                setApiUrl('http://10.0.2.2:3001');
                setConnStatus(null);
              }}
            >
              <Text style={styles.btnSmallText}>Emulator (10.0.2.2:3001)</Text>
            </TouchableOpacity>
          </View>

          {/* Connection Test Button */}
          <TouchableOpacity
            style={[styles.btnSmall, { backgroundColor: '#334155', marginTop: 12, paddingVertical: 10, alignSelf: 'center', width: '100%', alignItems: 'center' }]}
            disabled={testingConn}
            onPress={async () => {
              setTestingConn(true);
              setConnStatus('Probando conexión con el servidor...');
              try {
                const res = await posApi.testConnection(apiUrl);
                if (res.ok) {
                  setConnStatus(`✓ Conectado (${res.latencyMs}ms) • ${res.isHttps ? 'HTTPS Seguro' : 'HTTP Local'}`);
                } else {
                  setConnStatus(`✗ Error: ${res.error || 'No alcanzable'} (${res.latencyMs}ms)`);
                }
              } catch (err: any) {
                setConnStatus(`✗ Error: ${err.message}`);
              } finally {
                setTestingConn(false);
              }
            }}
          >
            <Text style={[styles.btnSmallText, { fontSize: 13, fontWeight: 'bold' }]}>
              {testingConn ? 'Verificando...' : '🔍 Probar Conexión'}
            </Text>
          </TouchableOpacity>

          {connStatus ? (
            <Text style={{
              color: connStatus.startsWith('✓') ? '#22c55e' : '#ef4444',
              fontSize: 12,
              marginTop: 8,
              textAlign: 'center',
              fontWeight: '600'
            }}>
              {connStatus}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              await setBaseApiUrl(apiUrl);
              Alert.alert('Guardado', 'URL del servidor actualizada. Sesión reiniciada por seguridad.');
              await loadInitialData();
              setCurrentScreen('PIN');
            }}
          >
            <Text style={styles.btnText}>Guardar y Reconectar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => setCurrentScreen('PIN')}
          >
            <Text style={styles.btnSecondaryText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CHECKOUT MODAL */}
      <Modal visible={showCheckoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Forma de Pago — Total: {formatMoney(grandTotalCents)}</Text>

            {/* Payment Method Selector */}
            <View style={styles.payMethodsRow}>
              {(['CASH', 'CARD', 'WALLET'] as const).map(method => (
                <TouchableOpacity
                  key={method}
                  style={[styles.payMethodBtn, paymentMethod === method && styles.payMethodBtnActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[styles.payMethodText, paymentMethod === method && styles.payMethodTextActive]}>
                    {method === 'CASH' ? '💵 Efectivo' : method === 'CARD' ? '💳 Tarjeta' : '📱 Yape/Plin'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cash Tender Input & Quick Denominations */}
            {paymentMethod === 'CASH' && (
              <View style={styles.cashSection}>
                <Text style={styles.label}>Monto Recibido en Efectivo (S/):</Text>
                <TextInput
                  style={styles.inputLarge}
                  keyboardType="numeric"
                  value={cashTenderedInput}
                  onChangeText={setCashTenderedInput}
                />
                <View style={styles.quickDenomRow}>
                  {[10, 20, 50, 100].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={styles.denomChip}
                      onPress={() => setCashTenderedInput(val.toString())}
                    >
                      <Text style={styles.denomChipText}>S/ {val}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.denomChip}
                    onPress={() => setCashTenderedInput((grandTotalCents / 100).toFixed(2))}
                  >
                    <Text style={styles.denomChipText}>Exacto</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.changeText}>
                  Vuelto a Entregar: {formatMoney(Math.max(0, Math.round(parseFloat(cashTenderedInput || '0') * 100) - grandTotalCents))}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowCheckoutModal(false)}
                disabled={isSubmittingCheckout}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={handleConfirmCheckout}
                disabled={isSubmittingCheckout}
              >
                {isSubmittingCheckout ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnConfirmText}>Confirmar Venta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* THERMAL RECEIPT MODAL */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptPaper}>
            <Text style={styles.receiptHeader}>CAFÉ DEL PARQUE</Text>
            <Text style={styles.receiptSub}>RUC: 20601234567</Text>
            <Text style={styles.receiptSub}>BOLETA DE VENTA ELECTRÓNICA</Text>
            <Text style={styles.receiptReceiptNum}>{completedOrder?.receipt_number || completedOrder?.receiptNumber}</Text>
            <Text style={styles.receiptDate}>{new Date(completedOrder?.created_at || Date.now()).toLocaleString()}</Text>
            <View style={styles.receiptDivider} />

            {completedOrder?.items?.map((it: any, idx: number) => (
              <View key={it.id || idx} style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>{it.quantity}x {it.product_name || it.name}</Text>
                <Text style={styles.receiptItemPrice}>{formatMoney(it.total || (it.unit_price * it.quantity))}</Text>
              </View>
            ))}

            <View style={styles.receiptDivider} />
            <View style={styles.receiptItemRow}>
              <Text style={styles.receiptSmall}>Subtotal:</Text>
              <Text style={styles.receiptSmall}>{formatMoney(completedOrder?.subtotal || 0)}</Text>
            </View>
            <View style={styles.receiptItemRow}>
              <Text style={styles.receiptSmall}>IGV (18% inc):</Text>
              <Text style={styles.receiptSmall}>{formatMoney(completedOrder?.tax_total || 0)}</Text>
            </View>
            <View style={[styles.receiptItemRow, { marginTop: 4 }]}>
              <Text style={styles.receiptBold}>TOTAL:</Text>
              <Text style={styles.receiptBold}>{formatMoney(completedOrder?.total || 0)}</Text>
            </View>
            {completedOrder?.payments?.[0]?.change_due !== undefined && (
              <View style={styles.receiptItemRow}>
                <Text style={styles.receiptSmall}>Vuelto:</Text>
                <Text style={styles.receiptSmall}>{formatMoney(completedOrder.payments[0].change_due)}</Text>
              </View>
            )}
            <Text style={styles.receiptFooter}>¡Gracias por su visita!</Text>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.btnText}>Nueva Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SAVE TICKET MODAL */}
      <Modal visible={showSaveTicketModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Guardar Ticket Abierto</Text>
            <Text style={styles.label}>Nombre o Identificador del Ticket:</Text>
            <TextInput
              style={[styles.inputLarge, { fontSize: 18, height: 48 }]}
              value={ticketNameInput}
              onChangeText={setTicketNameInput}
              placeholder="Ej. Mesa 4, Barra 2, Para Llevar"
              placeholderTextColor="#64748b"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowSaveTicketModal(false)}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={handleSaveTicket}
              >
                <Text style={styles.btnConfirmText}>Guardar Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OPEN TICKETS MODAL */}
      <Modal visible={showOpenTicketsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: 500, maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Tickets Abiertos ({openTickets.length})</Text>
            <FlatList
              data={openTickets}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ticketCard}
                  onPress={() => handleRecallTicket(item)}
                >
                  <View>
                    <Text style={styles.ticketCardTitle}>{item.ticket_name || item.name || 'Ticket sin nombre'}</Text>
                    <Text style={styles.ticketCardSub}>
                      {item.items?.length || 0} productos • {new Date(item.created_at || Date.now()).toLocaleTimeString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>
                      {formatMoney(item.total || (item.items || []).reduce((acc: number, it: any) => acc + (it.unit_price * it.quantity), 0))}
                    </Text>
                    <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                      Cargar ➔
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#64748b', paddingVertical: 20 }}>
                  No hay tickets abiertos actualmente.
                </Text>
              }
            />
            <TouchableOpacity
              style={[styles.btnSecondary, { marginTop: 14 }]}
              onPress={() => setShowOpenTicketsModal(false)}
            >
              <Text style={styles.btnSecondaryText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CUSTOMER SELECTION MODAL */}
      <Modal visible={showCustomerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { width: 480, maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
            <FlatList
              data={customers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.customerRow,
                    selectedCustomer?.id === item.id && { borderColor: '#10b981', borderWidth: 1 }
                  ]}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setShowCustomerModal(false);
                  }}
                >
                  <View>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{item.name}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11 }}>{item.phone || item.email || 'Sin contacto'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12 }}>
                      {item.loyalty_points || 0} pts
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#64748b', paddingVertical: 20 }}>
                  No hay clientes registrados en el catálogo.
                </Text>
              }
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => {
                  setSelectedCustomer(null);
                  setShowCustomerModal(false);
                }}
              >
                <Text style={styles.btnSecondaryText}>Sin Cliente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => setShowCustomerModal(false)}
              >
                <Text style={styles.btnSecondaryText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SHIFT DETAILS & CLOSE MODAL */}
      <Modal visible={showShiftModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Gestión de Turno de Caja</Text>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Cajero:</Text>
                <Text style={styles.totalValue}>{currentEmployee?.name}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Fondo Inicial:</Text>
                <Text style={styles.totalValue}>{formatMoney(activeShift?.opening_cash || 0)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Efectivo Esperado en Caja:</Text>
                <Text style={[styles.totalValue, { color: '#10b981' }]}>{formatMoney(activeShift?.expected_cash || 0)}</Text>
              </View>
            </View>

            <Text style={styles.label}>Efectivo Real Contado en Gaveta (S/):</Text>
            <TextInput
              style={[styles.inputLarge, { fontSize: 20, height: 50 }]}
              keyboardType="numeric"
              value={closingCashInput}
              onChangeText={setClosingCashInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowShiftModal(false)}
                disabled={isClosingShift}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, { backgroundColor: '#e11d48' }]}
                onPress={handleCloseShift}
                disabled={isClosingShift}
              >
                {isClosingShift ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnConfirmText}>Cerrar Turno</Text>
                )}
              </TouchableOpacity>
            </View>
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
  linkSettings: { marginTop: 24 },
  linkSettingsText: { color: '#64748b', fontSize: 13 },

  shiftOpenContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  shiftSubText: { color: '#94a3b8', fontSize: 14, marginBottom: 12 },
  inputLarge: { width: '80%', height: 60, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, fontSize: 26, fontWeight: 'bold', color: '#10b981', textAlign: 'center', marginVertical: 16 },
  inputUrl: { width: '80%', height: 48, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, color: '#fff', paddingHorizontal: 12, marginBottom: 16 },
  quickUrlRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  btnSmall: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnSmallText: { color: '#94a3b8', fontSize: 11 },

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
  navBtnLock: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  navBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchInput: { flex: 2, height: 42, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 12, color: '#fff', fontSize: 13 },
  barcodeInput: { flex: 1, height: 42, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 12, color: '#10b981', fontSize: 13, fontWeight: 'bold' },
  categoryScroll: { maxHeight: 42, marginBottom: 8 },
  catPill: { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  catPillActive: { backgroundColor: '#10b981' },
  catPillText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  catPillTextActive: { color: '#fff' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12, fontSize: 13 },
  gridContent: { paddingBottom: 20 },
  productCard: { flex: 1, minWidth: '30%', backgroundColor: '#0f172a', borderWidth: 1, borderRadius: 12, padding: 8, margin: 4, minHeight: 110 },
  productImage: { width: '100%', height: 70, borderRadius: 8, marginBottom: 6, backgroundColor: '#1e293b' },
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
  modalBox: { width: 440, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 14 },
  payMethodsRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  payMethodBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  payMethodBtnActive: { backgroundColor: '#064e3b', borderWidth: 1, borderColor: '#10b981' },
  payMethodText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 12 },
  payMethodTextActive: { color: '#10b981' },
  cashSection: { marginVertical: 10 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  quickDenomRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  denomChip: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  denomChipText: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  changeText: { color: '#10b981', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 8 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnCancel: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnCancelText: { color: '#94a3b8', fontWeight: 'bold' },
  btnConfirm: { flex: 1, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnConfirmText: { color: '#fff', fontWeight: 'bold' },

  receiptPaper: { width: 320, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  receiptHeader: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#000' },
  receiptSub: { fontSize: 10, textAlign: 'center', color: '#333' },
  receiptReceiptNum: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: '#000', marginVertical: 2 },
  receiptDate: { fontSize: 9, textAlign: 'center', color: '#666' },
  receiptDivider: { height: 1, backgroundColor: '#ccc', marginVertical: 8 },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptItemName: { fontSize: 11, color: '#000' },
  receiptItemPrice: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  receiptSmall: { fontSize: 10, color: '#444' },
  receiptBold: { fontSize: 13, fontWeight: 'bold', color: '#000' },
  receiptFooter: { fontSize: 10, textAlign: 'center', marginVertical: 10, color: '#555' },
  btnPrimary: { backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },

  parkBtn: { backgroundColor: '#1e3a5f', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  parkBtnText: { color: '#93c5fd', fontSize: 11, fontWeight: 'bold' },
  customerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginVertical: 6 },
  customerBarText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },
  removeCustomerText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 4 },
  ticketCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketCardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  ticketCardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  customerRow: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

