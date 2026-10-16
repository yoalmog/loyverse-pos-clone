/**
 * AuraPOS Phase 9 — Multi-Store Stock Transfer Service
 * Manages inter-branch inventory transfers:
 * - Transfer requisition creation (source -> destination)
 * - Shipping dispatch with source stock deduction and audit ledger recording
 * - Destination receiving with stock increments and audit ledger recording
 * - Idempotent cancellation and restock handling
 */

import { StorageService } from './storageService.ts';
import { StockTransfer, StockTransferItem } from '../types/advancedFeatures.ts';
import { InventoryMovement, Product } from '../types/pos.ts';

export class MultiStoreTransferService {
  /**
   * Create a new stock transfer requisition
   */
  static createTransfer(params: {
    sourceStoreId: string;
    sourceStoreName: string;
    destinationStoreId: string;
    destinationStoreName: string;
    items: StockTransferItem[];
    notes?: string;
  }): StockTransfer {
    const totalUnits = params.items.reduce((acc, i) => acc + i.quantity, 0);
    const totalCostValue = params.items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const nowIso = new Date().toISOString();

    const transfer: StockTransfer = {
      id: `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transferNumber: `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceStoreId: params.sourceStoreId,
      sourceStoreName: params.sourceStoreName,
      destinationStoreId: params.destinationStoreId,
      destinationStoreName: params.destinationStoreName,
      status: 'pending',
      items: params.items,
      totalUnits,
      totalCostValue,
      notes: params.notes,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const transfers = StorageService.getStockTransfers();
    transfers.unshift(transfer);
    StorageService.saveStockTransfers(transfers);

    return transfer;
  }

  /**
   * Dispatch and ship transfer from source store
   * Deducts source store inventory and records transfer movement
   */
  static shipTransfer(
    transferId: string,
    shippedBy: string
  ): { transfer: StockTransfer; movements: InventoryMovement[] } {
    const transfers = StorageService.getStockTransfers();
    const tIndex = transfers.findIndex(t => t.id === transferId);
    if (tIndex === -1) throw new Error(`Stock transfer ${transferId} not found`);

    const transfer = transfers[tIndex];
    if (transfer.status !== 'pending' && transfer.status !== 'draft') {
      throw new Error(`Transfer cannot be shipped from status "${transfer.status}"`);
    }

    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    // Deduct stock from source store
    transfer.items.forEach(item => {
      const pIndex = allProducts.findIndex(p => p.id === item.productId || p.sku === item.sku);
      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        const prevQty = prod.stock;
        const newQty = Math.max(0, prevQty - item.quantity);

        allProducts[pIndex] = {
          ...prod,
          stock: newQty,
          updatedAt: nowIso
        };

        const movement: InventoryMovement = {
          id: `mov_trf_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeId: transfer.sourceStoreId,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'transfer',
          quantity: -item.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reason: `Transfer Shipped to ${transfer.destinationStoreName} (${transfer.transferNumber})`,
          referenceId: transfer.id,
          employeeId: 'staff_dispatcher',
          employeeName: shippedBy,
          createdAt: nowIso
        };

        newMovements.push(movement);
      }
    });

    transfer.status = 'in_transit';
    transfer.shippedBy = shippedBy;
    transfer.shippedAt = nowIso;
    transfer.updatedAt = nowIso;
    transfers[tIndex] = transfer;

    StorageService.saveProducts(allProducts);
    StorageService.saveStockTransfers(transfers);
    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { transfer, movements: newMovements };
  }

  /**
   * Receive and accept transfer at destination store
   * Increments destination store inventory and records inbound transfer movement
   */
  static receiveTransfer(
    transferId: string,
    receivedBy: string
  ): { transfer: StockTransfer; movements: InventoryMovement[] } {
    const transfers = StorageService.getStockTransfers();
    const tIndex = transfers.findIndex(t => t.id === transferId);
    if (tIndex === -1) throw new Error(`Stock transfer ${transferId} not found`);

    const transfer = transfers[tIndex];
    if (transfer.status !== 'in_transit') {
      throw new Error(`Transfer cannot be received from status "${transfer.status}"`);
    }

    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    // Credit stock to destination store (find product by SKU or create entry)
    transfer.items.forEach(item => {
      let pIndex = allProducts.findIndex(
        p => (p.id === item.productId || p.sku === item.sku) && p.storeId === transfer.destinationStoreId
      );

      // If destination store shares product or needs stock assigned
      if (pIndex === -1) {
        pIndex = allProducts.findIndex(p => p.sku === item.sku);
      }

      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        const prevQty = prod.stock;
        const newQty = prevQty + item.quantity;

        allProducts[pIndex] = {
          ...prod,
          stock: newQty,
          cost: item.unitCost,
          updatedAt: nowIso
        };

        const movement: InventoryMovement = {
          id: `mov_trf_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeId: transfer.destinationStoreId,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'transfer',
          quantity: item.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty,
          reason: `Transfer Received from ${transfer.sourceStoreName} (${transfer.transferNumber})`,
          referenceId: transfer.id,
          employeeId: 'staff_receiver',
          employeeName: receivedBy,
          createdAt: nowIso
        };

        newMovements.push(movement);
      }
    });

    transfer.status = 'received';
    transfer.receivedBy = receivedBy;
    transfer.receivedAt = nowIso;
    transfer.updatedAt = nowIso;
    transfers[tIndex] = transfer;

    StorageService.saveProducts(allProducts);
    StorageService.saveStockTransfers(transfers);
    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { transfer, movements: newMovements };
  }

  /**
   * Cancel transfer (re-stocks source store if already shipped)
   */
  static cancelTransfer(
    transferId: string,
    cancelledBy: string
  ): { transfer: StockTransfer; movements: InventoryMovement[] } {
    const transfers = StorageService.getStockTransfers();
    const tIndex = transfers.findIndex(t => t.id === transferId);
    if (tIndex === -1) throw new Error(`Stock transfer ${transferId} not found`);

    const transfer = transfers[tIndex];
    if (transfer.status === 'received' || transfer.status === 'cancelled') {
      throw new Error(`Cannot cancel transfer already in status "${transfer.status}"`);
    }

    const allProducts = StorageService.getProducts();
    const allMovements = StorageService.getInventoryMovements();
    const nowIso = new Date().toISOString();
    const newMovements: InventoryMovement[] = [];

    // If it was already in transit, restore deducted items back to source
    if (transfer.status === 'in_transit') {
      transfer.items.forEach(item => {
        const pIndex = allProducts.findIndex(p => p.id === item.productId || p.sku === item.sku);
        if (pIndex !== -1) {
          const prod = allProducts[pIndex];
          const prevQty = prod.stock;
          const newQty = prevQty + item.quantity;

          allProducts[pIndex] = {
            ...prod,
            stock: newQty,
            updatedAt: nowIso
          };

          const movement: InventoryMovement = {
            id: `mov_trf_cancel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            storeId: transfer.sourceStoreId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'transfer',
            quantity: item.quantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Transfer Cancelled & Returned (${transfer.transferNumber})`,
            referenceId: transfer.id,
            employeeId: 'staff_dispatcher',
            employeeName: cancelledBy,
            createdAt: nowIso
          };

          newMovements.push(movement);
        }
      });
      StorageService.saveProducts(allProducts);
    }

    transfer.status = 'cancelled';
    transfer.updatedAt = nowIso;
    transfers[tIndex] = transfer;
    StorageService.saveStockTransfers(transfers);

    if (newMovements.length > 0) {
      allMovements.unshift(...newMovements);
      StorageService.saveInventoryMovements(allMovements);
    }

    return { transfer, movements: newMovements };
  }
}
