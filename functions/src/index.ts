import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

initializeApp();
const db = getFirestore();

/**
 * Fan out a customer order into seller-scoped order records.
 * The callable createOrder endpoint validates the published catalog and stores server-calculated prices.
 * This trigger fans the trusted order snapshot out into seller-scoped records.
 */
export const fanOutSellerOrders = onDocumentCreated({ document: 'orders/{orderId}', region: 'asia-south1' }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const order = snap.data();
  if (!Array.isArray(order.items)) return;
  const bySeller = new Map<string, any[]>();
  for (const item of order.items) {
    if (!item || typeof item.sellerId !== 'string' || typeof item.price !== 'number' || item.price < 0) continue;
    const sellerItems = bySeller.get(item.sellerId) ?? [];
    sellerItems.push(item);
    bySeller.set(item.sellerId, sellerItems);
  }
  const batch = db.batch();
  for (const [sellerId, items] of bySeller.entries()) {
    const sellerOrder = db.collection('sellerOrders').doc(`${event.params.orderId}_${sellerId}`);
    batch.set(sellerOrder, {
      parentOrderId: event.params.orderId,
      orderNumber: order.orderNumber ?? event.params.orderId,
      sellerId,
      customerName: order.customerName ?? '',
      phone: order.phone ?? '',
      city: order.city ?? '',
      address: order.address ?? '',
      notes: order.notes ?? '',
      playerId: order.playerId ?? '',
      serverId: order.serverId ?? '',
      gameUsername: order.gameUsername ?? '',
      items,
      total: items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
      currency: 'PKR',
      paymentMethod: order.paymentMethod ?? 'cod',
      paymentReference: order.paymentReference ?? '',
      paymentStatus: order.paymentStatus ?? 'pending_verification',
      orderStatus: 'new',
      createdAt: order.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  logger.info('Created seller order views', { orderId: event.params.orderId, sellerCount: bySeller.size });
});


/** Secure public checkout: product prices, seller IDs and totals are read from Firestore on the server. */
export const createOrder = onCall({ region: 'asia-south1', enforceAppCheck: false }, async (request) => {
  const d = request.data ?? {};
  const requiredStrings = ['customerName','phone','paymentMethod'];
  for (const key of requiredStrings) if (typeof d[key] !== 'string' || !d[key].trim()) throw new HttpsError('invalid-argument', `Missing ${key}.`);
  if (d.customerName.trim().length < 2 || d.customerName.length > 100) throw new HttpsError('invalid-argument', 'Enter a valid customer name.');
  if (d.phone.trim().length < 10 || d.phone.length > 20) throw new HttpsError('invalid-argument', 'Enter a valid phone number.');
  if (typeof d.city !== 'string' || d.city.length > 80 || typeof d.address !== 'string' || d.address.length > 500) throw new HttpsError('invalid-argument', 'Invalid city or delivery address.');
  if (!['cod','online'].includes(d.paymentMethod)) throw new HttpsError('invalid-argument', 'Unsupported payment method.');
  if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 30) throw new HttpsError('invalid-argument', 'Invalid order items.');
  if (d.paymentMethod === 'online' && (typeof d.paymentReference !== 'string' || d.paymentReference.trim().length < 3 || d.paymentReference.length > 100)) throw new HttpsError('invalid-argument', 'Enter a valid transaction reference.');
  if (typeof d.playerId === 'string' && d.playerId.length > 100) throw new HttpsError('invalid-argument', 'Invalid game Player ID.');
  if (typeof d.serverId === 'string' && d.serverId.length > 100) throw new HttpsError('invalid-argument', 'Invalid game Server ID.');
  const normalized = [];
  for (const line of d.items) {
    if (!line || typeof line.productId !== 'string') throw new HttpsError('invalid-argument', 'Invalid product selection.');
    const quantity = Number(line.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new HttpsError('invalid-argument', 'Quantity must be between 1 and 10.');
    const snap = await db.collection('products').doc(line.productId).get();
    if (!snap.exists || snap.data()?.status !== 'published') throw new HttpsError('failed-precondition', 'One or more products are unavailable.');
    const p = snap.data()!;
    if (typeof p.price !== 'number' || p.price <= 0 || typeof p.sellerId !== 'string') throw new HttpsError('failed-precondition', 'A product is not configured correctly.');
    normalized.push({ productId: snap.id, title: String(p.title ?? 'Product').slice(0,160), price: p.price, quantity, type: p.type === 'digital' ? 'digital' : 'physical', sellerId: p.sellerId, sellerName: String(p.sellerName ?? 'Marketplace seller').slice(0,100), gameTopUp: p.gameTopUp === true, gameName: p.gameTopUp === true ? String(p.gameName ?? '').slice(0,80) : '', gamePackage: p.gameTopUp === true ? String(p.gamePackage ?? '').slice(0,100) : '' });
  }
  if (normalized.some(p => p.type === 'physical') && (d.city.trim().length < 2 || d.address.trim().length < 8)) throw new HttpsError('invalid-argument', 'Enter a city and full delivery address for physical products.');
  if (d.paymentMethod === 'cod' && normalized.some(p => p.type === 'digital')) throw new HttpsError('failed-precondition', 'Cash on Delivery is not available for digital products.');
  if (normalized.some(p => p.gameTopUp) && (typeof d.playerId !== 'string' || d.playerId.trim().length < 3)) throw new HttpsError('invalid-argument', 'Enter the game Player ID for the top-up.');
  const total = normalized.reduce((sum,p) => sum + p.price * p.quantity, 0);
  if (!Number.isSafeInteger(Math.round(total)) || total <= 0 || total > 100000000) throw new HttpsError('failed-precondition', 'Order total is invalid.');
  const orderNumber = `MZ-${Date.now().toString().slice(-8)}`;
  const ref = await db.collection('orders').add({ orderNumber, customerName: d.customerName.trim(), phone: d.phone.trim(), email: typeof d.email === 'string' ? d.email.trim().slice(0,150) : '', city: d.city.trim(), address: d.address.trim(), notes: typeof d.notes === 'string' ? d.notes.trim().slice(0,500) : '', playerId: typeof d.playerId === 'string' ? d.playerId.trim().slice(0,100) : '', serverId: typeof d.serverId === 'string' ? d.serverId.trim().slice(0,100) : '', gameUsername: typeof d.gameUsername === 'string' ? d.gameUsername.trim().slice(0,100) : '', items: normalized, total, currency: 'PKR', paymentMethod: d.paymentMethod, paymentReference: typeof d.paymentReference === 'string' ? d.paymentReference.trim().slice(0,100) : '', paymentStatus: d.paymentMethod === 'cod' ? 'cod_due' : 'pending_verification', orderStatus: 'new', createdAt: FieldValue.serverTimestamp(), customerUid: request.auth?.uid ?? null });
  return { id: ref.id, orderNumber, total };
});
