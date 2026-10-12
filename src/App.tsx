import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShoppingBag,
  Heart,
  ArrowRight,
  ShieldCheck,
  Download,
  X,
  Gamepad2,
  Package,
  Truck,
  Smartphone,
  Shirt,
  Home,
  Laptop,
  RotateCcw,
  BadgeCheck,
  UserRound,
  Store,
  ClipboardList,
  LogOut,
  LayoutGrid,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Settings,
  ChevronRight,
} from "lucide-react";
import { categories } from "../shared/src/data";
import type { Product } from "../shared/src/types";
import { auth, configured, db, functions } from "../shared/src/firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import heroImg from "./assets/images/hero_marketplace_showcase_1791779144263.jpg";
import gamingImg from "./assets/images/gaming_topup_spotlight_1791779158038.jpg";
import digitalImg from "./assets/images/digital_creator_assets_1791779171481.jpg";

const money = (n: number) => `PKR ${(Number(n) || 0).toLocaleString("en-PK")}`;

interface CheckoutLine {
  product: Product;
  quantity: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAtText: string;
  items: Array<{
    productId: string;
    title: string;
    price: number;
    quantity: number;
    sellerName: string;
    type: string;
  }>;
}

interface SellerApplicationDoc {
  uid: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  categoryFocus: string;
  membershipPlan: "trial_30_days" | "lifetime_direct";
  trialEndsAt?: string;
  lifetimeFeeAmount?: number;
  paymentStatus?: string;
  status: "pending" | "approved" | "active" | "rejected" | "suspended";
  adminNote?: string;
  approvedRole?: string;
}

type MainTab = "home" | "categories" | "orders" | "profile";
type ProfileSection = "account" | "seller" | "wishlist" | "addresses";
type SortOption = "featured" | "price-asc" | "price-desc" | "rating";

const HERO_SLIDES = [
  {
    id: "mall",
    kicker: "☪ PAKISTAN’S OWN MARKETPLACE · NATIONWIDE DELIVERY",
    title: "Authentic Tech, Fashion & Home Deals Across Pakistan",
    subtitle:
      "Shop verified Pakistani stores with Cash on Delivery, transparent pricing, and real-time order tracking.",
    ctaText: "Explore Marketplace",
    category: "All",
    typeFilter: "all" as const,
    image: heroImg,
  },
  {
    id: "gaming",
    kicker: "INSTANT GAMING DESK · PLAYER ID TOP-UPS",
    title: "PUBG Mobile UC, Free Fire & Ludo Diamonds",
    subtitle:
      "Fast game currency top-ups credited directly to your Player ID after payment verification.",
    ctaText: "Shop Game Top-Ups",
    category: "Gaming",
    typeFilter: "all" as const,
    image: gamingImg,
  },
  {
    id: "digital",
    kicker: "DIGITAL CREATOR STORE · INSTANT ACCESS",
    title: "Software, Templates & Digital Downloads",
    subtitle:
      "Get design kits, learning resources, and digital tools from Pakistani creators with verified online transfer.",
    ctaText: "Browse Digital Store",
    category: "Digital Products",
    typeFilter: "digital" as const,
    image: digitalImg,
  },
];

const DEPARTMENT_TILES = [
  { name: "Electronics", icon: Laptop, desc: "Audio, watches & gadgets" },
  { name: "Phones & Accessories", icon: Smartphone, desc: "Chargers, covers & cables" },
  { name: "Gaming", icon: Gamepad2, desc: "PUBG UC, Free Fire & Ludo" },
  { name: "Fashion", icon: Shirt, desc: "Men, women & eastern wear" },
  { name: "Home & Kitchen", icon: Home, desc: "Appliances & daily living" },
  { name: "Digital Products", icon: Download, desc: "Templates, tools & guides" },
];

const ORDER_STEPS = [
  { key: "new", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Packing / Processing" },
  { key: "shipped", label: "On the Way" },
  { key: "completed", label: "Delivered" },
];

function getOrderStepIndex(status: string): number {
  const s = (status || "new").toLowerCase();
  if (s === "completed" || s === "delivered") return 4;
  if (s === "shipped" || s === "dispatched") return 3;
  if (s === "processing" || s === "packed") return 2;
  if (s === "confirmed" || s === "verified") return 1;
  return 0;
}

function ProductCard({
  product,
  onAdd,
  onBuy,
  onWishlist,
  onQuickView,
  isWishlisted,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  onBuy: (p: Product) => void;
  onWishlist: (p: Product) => void;
  onQuickView: (p: Product) => void;
  isWishlisted: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasValidImg = Boolean(product.images?.[0]) && !imgFailed;

  const discountPercent =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  const formatLabel = product.gameTopUp
    ? product.gamePackage || "Game Top-Up"
    : product.type === "digital"
      ? product.digitalFormat || "Digital Download"
      : "Cash on Delivery";

  return (
    <article className="product-card">
      <div className="product-media" onClick={() => onQuickView(product)}>
        <button
          type="button"
          className={`wishlist-trigger ${isWishlisted ? "active" : ""}`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={isWishlisted}
          onClick={(e) => {
            e.stopPropagation();
            onWishlist(product);
          }}
        >
          <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        {hasValidImg ? (
          <img
            className="product-image"
            src={product.images[0]}
            alt={product.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : product.gameTopUp ? (
          <div className="product-fallback-art game-art">
            <Gamepad2 size={38} />
            <span>{product.gamePackage || product.gameName || "Game Top-Up"}</span>
          </div>
        ) : product.type === "digital" ? (
          <div className="product-fallback-art">
            <Download size={36} />
            <span>{product.digitalFormat || "Digital Asset"}</span>
          </div>
        ) : (
          <div className="product-fallback-art">
            <Package size={36} />
            <span>{product.category || "Marketplace Product"}</span>
          </div>
        )}
      </div>

      <div className="product-body">
        <div className="product-meta">
          <span className="product-meta-seller">
            {product.gameTopUp ? product.gameName || product.sellerName : product.sellerName}
          </span>
          <span aria-hidden="true">·</span>
          <span>{product.category}</span>
          <span aria-hidden="true">·</span>
          <span>{formatLabel}</span>
        </div>

        <h3 className="product-title" onClick={() => onQuickView(product)}>
          {product.title}
        </h3>

        <div className="product-rating-line">
          <span className="stars-gold">
            ★ {product.rating ? product.rating.toFixed(1) : "New"}
          </span>
          <span>·</span>
          <span>
            {product.reviewCount
              ? `${product.reviewCount} verified ratings`
              : product.gameTopUp
                ? "Player ID delivery"
                : "Verified Pakistani Seller"}
          </span>
        </div>

        <div className="product-price-block">
          <div>
            <strong className="product-price">{money(product.price)}</strong>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <del className="product-compare">{money(product.compareAtPrice)}</del>
            )}
          </div>
          {discountPercent > 0 && <span className="discount-text">-{discountPercent}%</span>}
        </div>

        <div className="product-actions">
          <button type="button" className="btn-cart" onClick={() => onAdd(product)}>
            <ShoppingBag size={15} /> Add to Cart
          </button>
          <button type="button" className="btn-buy-now" onClick={() => onBuy(product)}>
            Buy Now <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function matchesCategory(p: Product, activeCategory: string): boolean {
  if (activeCategory === "All") return true;
  if (p.category === activeCategory) return true;
  if (activeCategory === "Gaming" && p.gameTopUp) return true;
  if (activeCategory === "Digital Products" && p.type === "digital") return true;
  const hay = `${p.title ?? ""} ${p.gameName ?? ""} ${p.gamePackage ?? ""} ${p.category ?? ""}`.toLowerCase();
  if (activeCategory === "PUBG Mobile UC" && p.gameTopUp && hay.includes("pubg")) return true;
  if (
    activeCategory === "Free Fire Diamonds" &&
    p.gameTopUp &&
    (hay.includes("free fire") || hay.includes("freefire"))
  ) {
    return true;
  }
  if (activeCategory === "Ludo Diamonds" && p.gameTopUp && hay.includes("ludo")) return true;
  return false;
}

export default function App() {
  const catalogSectionRef = useRef<HTMLElement | null>(null);

  // Main Daraz-inspired navigation tabs: Home, Categories, My Orders (with Track Order), User Profile (with Settings & Become a Seller)
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [profileSection, setProfileSection] = useState<ProfileSection>("account");

  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(configured);
  const [activeCategory, setActiveCategory] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"all" | "physical" | "digital">("all");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [cart, setCart] = useState<CheckoutLine[]>([]);
  const [toast, setToast] = useState("");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Auth, User Profile & Role state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("customer");
  const [userSellerStatus, setUserSellerStatus] = useState<string>("");
  const [sellerApplication, setSellerApplication] = useState<SellerApplicationDoc | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    password: "",
  });

  // Orders & Live Order Tracking state
  const [userOrders, setUserOrders] = useState<OrderRecord[]>([]);
  const [localOrders, setLocalOrders] = useState<OrderRecord[]>([]);
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackedOrderResult, setTrackedOrderResult] = useState<OrderRecord | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingBusy, setTrackingBusy] = useState(false);

  const [lifetimeFeeSetting, setLifetimeFeeSetting] = useState<number>(2500);

  // Become a Seller Form state (Inside User Profile Settings)
  const [sellerSubmitting, setSellerSubmitting] = useState(false);
  const [sellerError, setSellerError] = useState("");
  const [sellerSuccess, setSellerSuccess] = useState("");
  const [sellerForm, setSellerForm] = useState({
    plan: "trial_30_days" as "trial_30_days" | "lifetime_direct",
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    city: "",
    categoryFocus: "Physical & Digital Products",
    accountTitle: "",
    easypaisa: "",
    jazzcash: "",
    bankName: "",
    bankAccount: "",
    paymentReference: "",
  });

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutLine[]>([]);
  const [checkoutFromCart, setCheckoutFromCart] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState<any[]>([]);
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    payment: "cod",
    paymentReference: "",
    notes: "",
    playerId: "",
    serverId: "",
    gameUsername: "",
  });

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), ms);
  };

  const scrollToCatalog = () => {
    if (activeTab !== "home" && activeTab !== "categories") {
      setActiveTab("home");
      window.setTimeout(() => {
        catalogSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } else {
      catalogSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openProfileSection = (sec: ProfileSection) => {
    setAuthError("");
    setAuthMessage("");
    setSellerError("");
    setSellerSuccess("");
    setProfileSection(sec);
    setActiveTab("profile");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  // Load saved wishlist, local order history, and local seller application fallback
  useEffect(() => {
    try {
      const savedWish = JSON.parse(localStorage.getItem("megazone_wishlist") || "[]");
      if (Array.isArray(savedWish)) {
        setWishlistIds(savedWish.filter((x: unknown): x is string => typeof x === "string"));
      }
      const savedOrders = JSON.parse(localStorage.getItem("megazone_my_orders") || "[]");
      if (Array.isArray(savedOrders)) {
        setLocalOrders(savedOrders);
      }
      const savedSellerApp = JSON.parse(localStorage.getItem("megazone_seller_app") || "null");
      if (savedSellerApp && typeof savedSellerApp === "object") {
        setSellerApplication(savedSellerApp);
      }
    } catch {
      // Ignore corrupt localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("megazone_wishlist", JSON.stringify(wishlistIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [wishlistIds]);

  // Listen to Firebase Auth state & live User Document + Seller Application status from Admin Panel
  useEffect(() => {
    if (!configured || !auth) return;
    let unsubUserDoc: (() => void) | null = null;
    let unsubSellerApp: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      if (unsubSellerApp) {
        unsubSellerApp();
        unsubSellerApp = null;
      }

      if (!u) {
        setUserRole("customer");
        setUserSellerStatus("");
        return;
      }

      // Load local cached profile first so UI is immediate even if Firestore rules restrict read
      try {
        const localProf = JSON.parse(
          localStorage.getItem(`megazone_profile_${u.uid}`) || "{}",
        );
        const name = localProf.displayName || u.displayName || "";
        const phone = localProf.phone || "";
        const city = localProf.city || "";
        const address = localProf.address || "";
        setAuthForm((prev) => ({
          ...prev,
          name: name || prev.name,
          email: u.email || prev.email,
          phone: phone || prev.phone,
          city: city || prev.city,
          address: address || prev.address,
        }));
      } catch {}

      if (db) {
        // Real-time listener on users/{uid} so when Admin promotes user to seller/admin, they see it immediately
        unsubUserDoc = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            const name = data.displayName || data.name || u.displayName || "";
            const phone = data.phone || "";
            const city = data.city || "";
            const address = data.address || "";
            setUserRole(data.role || "customer");
            setUserSellerStatus(data.sellerStatus || data.status || "");

            setAuthForm((prev) => ({
              ...prev,
              name: name || prev.name,
              email: u.email || "",
              phone: phone || prev.phone,
              city: city || prev.city,
              address: address || prev.address,
            }));
            setCheckoutForm((prev) => ({
              ...prev,
              name: prev.name || name,
              email: prev.email || u.email || "",
              phone: prev.phone || phone,
              city: prev.city || city,
              address: prev.address || address,
            }));
            setSellerForm((prev) => ({
              ...prev,
              ownerName: prev.ownerName || name,
              email: prev.email || u.email || "",
              phone: prev.phone || phone,
              city: prev.city || city,
            }));
          },
          () => {
            // Ignore permission error if users collection is restricted
          },
        );

        // Real-time listener on sellerApplications/{uid} for Admin approval notification
        unsubSellerApp = onSnapshot(
          doc(db, "sellerApplications", u.uid),
          (snap) => {
            if (snap.exists()) {
              const appData = { uid: u.uid, ...snap.data() } as SellerApplicationDoc;
              setSellerApplication(appData);
              try {
                localStorage.setItem("megazone_seller_app", JSON.stringify(appData));
              } catch {}
            }
          },
          () => {
            // Ignore if rules restrict read on sellerApplications
          },
        );
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubSellerApp) unsubSellerApp();
    };
  }, []);

  // Load user's live orders from Firestore when logged in
  useEffect(() => {
    if (!configured || !db || !currentUser) {
      setUserOrders([]);
      return;
    }
    const q = query(collection(db, "orders"), where("customerUid", "==", currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: OrderRecord[] = snap.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          return {
            id: d.id,
            orderNumber: data.orderNumber || d.id,
            customerName: data.customerName || "",
            phone: data.phone || "",
            city: data.city || "",
            address: data.address || "",
            total: Number(data.total) || 0,
            paymentMethod: data.paymentMethod || "cod",
            paymentStatus: data.paymentStatus || "cod_due",
            orderStatus: data.orderStatus || "new",
            createdAtText: ts ? ts.toLocaleDateString("en-PK") : "Recent",
            items: Array.isArray(data.items) ? data.items : [],
          };
        });
        setUserOrders(list);
      },
      () => {
        // Fallback to localOrders if rules restrict
      },
    );
    return () => unsub();
  }, [currentUser]);

  // Load lifetime seller fee from settings/marketplacePayment
  useEffect(() => {
    if (!configured || !db) return;
    getDoc(doc(db, "settings", "marketplacePayment"))
      .then((snap) => {
        if (snap.exists() && typeof snap.data()?.lifetimeMembershipFee === "number") {
          setLifetimeFeeSetting(snap.data()!.lifetimeMembershipFee);
        }
      })
      .catch(() => {});
  }, []);

  // Load published catalog from Firestore
  useEffect(() => {
    if (!configured || !db) {
      setCatalog([]);
      setLoadingCatalog(false);
      return;
    }
    setLoadingCatalog(true);
    const q = query(collection(db, "products"), where("status", "==", "published"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCatalog(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoadingCatalog(false);
      },
      () => {
        setLoadingCatalog(false);
      },
    );
    return () => unsub();
  }, []);

  const allMyOrders = useMemo(() => {
    const map = new Map<string, OrderRecord>();
    for (const o of userOrders) map.set(o.orderNumber, o);
    for (const o of localOrders) {
      if (!map.has(o.orderNumber)) map.set(o.orderNumber, o);
    }
    return Array.from(map.values());
  }, [userOrders, localOrders]);

  // Determine if the user has been approved as Seller / Admin by the Admin Panel
  const isSellerApproved = useMemo(() => {
    if (
      userRole === "seller" ||
      userRole === "admin" ||
      userRole === "super_admin" ||
      userSellerStatus === "active" ||
      userSellerStatus === "approved"
    ) {
      return true;
    }
    if (
      sellerApplication &&
      (sellerApplication.status === "approved" || sellerApplication.status === "active")
    ) {
      return true;
    }
    return false;
  }, [userRole, userSellerStatus, sellerApplication]);

  const visible = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const filtered = catalog.filter(
      (p) =>
        matchesCategory(p, activeCategory) &&
        (typeFilter === "all" || p.type === typeFilter) &&
        (!qLower ||
          `${p.title ?? ""} ${p.category ?? ""} ${p.sellerName ?? ""} ${p.description ?? ""} ${p.gameName ?? ""} ${p.gamePackage ?? ""}`
            .toLowerCase()
            .includes(qLower)),
    );

    if (sortBy === "price-asc") {
      return [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
    }
    if (sortBy === "price-desc") {
      return [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0));
    }
    if (sortBy === "rating") {
      return [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return filtered;
  }, [catalog, searchQuery, activeCategory, typeFilter, sortBy]);

  const wishlistedProducts = useMemo(
    () => catalog.filter((p) => wishlistIds.includes(p.id)),
    [catalog, wishlistIds],
  );

  const totalCartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const add = (p: Product) => {
    setCart((old) => {
      const idx = old.findIndex((line) => line.product.id === p.id);
      if (idx >= 0) {
        return old.map((line, i) =>
          i === idx ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line,
        );
      }
      return [...old, { product: p, quantity: 1 }];
    });
    showToast(`${p.title} added to cart`);
  };

  const toggleWishlist = (p: Product) => {
    setWishlistIds((old) => {
      const exists = old.includes(p.id);
      const next = exists ? old.filter((id) => id !== p.id) : [...old, p.id];
      showToast(exists ? "Removed from wishlist" : "Saved to wishlist", 2200);
      return next;
    });
  };

  const buyNow = (p: Product) => {
    setQuickViewProduct(null);
    setCheckoutFromCart(false);
    setCheckoutItems([{ product: p, quantity: 1 }]);
    setCheckoutForm((f) => ({
      ...f,
      payment: p.type === "digital" ? "online" : "cod",
      paymentReference: "",
    }));
    setCheckoutError("");
    setOrderSuccess("");
    setCheckoutOpen(true);
  };

  const openCartCheckout = () => {
    if (!cart.length) {
      showToast("Your shopping cart is empty", 2200);
      return;
    }
    setCheckoutFromCart(true);
    setCheckoutItems(cart);
    setCheckoutForm((f) => ({
      ...f,
      payment: cart.some((line) => line.product.type === "digital") ? "online" : "cod",
      paymentReference: "",
    }));
    setCheckoutError("");
    setOrderSuccess("");
    setCheckoutOpen(true);
  };

  const updateCheckoutQty = (productId: string, delta: number) => {
    setCheckoutItems((prev) => {
      const next = prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.min(10, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0);
      if (checkoutFromCart) setCart(next);
      if (!next.length) setCheckoutOpen(false);
      return next;
    });
  };

  const checkoutTotal = useMemo(
    () => checkoutItems.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [checkoutItems],
  );

  const checkoutTotalCount = useMemo(
    () => checkoutItems.reduce((sum, line) => sum + line.quantity, 0),
    [checkoutItems],
  );

  const hasPhysical = useMemo(
    () => checkoutItems.some((line) => line.product.type === "physical"),
    [checkoutItems],
  );

  const hasDigital = useMemo(
    () => checkoutItems.some((line) => line.product.type === "digital"),
    [checkoutItems],
  );

  const hasGameTopUp = useMemo(
    () => checkoutItems.some((line) => Boolean(line.product.gameTopUp)),
    [checkoutItems],
  );

  useEffect(() => {
    if (hasDigital && checkoutForm.payment === "cod") {
      setCheckoutForm((f) => ({ ...f, payment: "online" }));
    }
  }, [hasDigital, checkoutForm.payment]);

  useEffect(() => {
    if (!checkoutOpen || checkoutForm.payment !== "online" || !configured || !db || !checkoutItems.length) {
      setPaymentInstructions([]);
      return;
    }
    let active = true;
    const ids = [...new Set(checkoutItems.map((line) => line.product.sellerId))];
    Promise.all(
      ids.map(async (sellerId) => {
        try {
          let s = await getDoc(doc(db!, "settings", `sellerPayment_${sellerId}`));
          if (!s.exists()) s = await getDoc(doc(db!, "settings", "marketplacePayment"));
          return s.exists()
            ? {
                sellerId,
                ...s.data(),
                sellerSubtotal: checkoutItems
                  .filter((line) => line.product.sellerId === sellerId)
                  .reduce((sum, line) => sum + line.product.price * line.quantity, 0),
              }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (active) setPaymentInstructions(rows.filter(Boolean));
    });
    return () => {
      active = false;
    };
  }, [checkoutOpen, checkoutForm.payment, checkoutItems]);

  // Handle Customer Login / Sign Up / Password Reset (Resilient against Firestore rule restrictions)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!configured || !auth) {
      setAuthError("Authentication service is temporarily unavailable.");
      return;
    }

    const cleanEmail = authForm.email.trim();
    if (!cleanEmail) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "reset") {
        await sendPasswordResetEmail(auth, cleanEmail);
        setAuthMessage("Password reset link has been sent to your email address.");
      } else if (authMode === "login") {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, authForm.password);
        // Safely update or sync local profile cache
        try {
          if (db) {
            const snap = await getDoc(doc(db, "users", cred.user.uid));
            if (!snap.exists()) {
              await setDoc(
                doc(db, "users", cred.user.uid),
                {
                  uid: cred.user.uid,
                  displayName: cred.user.displayName || cleanEmail.split("@")[0],
                  email: cleanEmail,
                  role: "customer",
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            }
          }
        } catch {
          // Never fail login if Firestore rules on users collection are restricted
        }
        showToast("Welcome back to MEGAZONE!");
        setAuthMessage("Signed in successfully.");
      } else {
        if (authForm.name.trim().length < 2) {
          setAuthError("Please enter your full name.");
          setAuthBusy(false);
          return;
        }
        if (authForm.password.length < 6) {
          setAuthError("Password must be at least 6 characters.");
          setAuthBusy(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, authForm.password);

        try {
          await updateProfile(cred.user, { displayName: authForm.name.trim() });
        } catch {}

        const profileData = {
          uid: cred.user.uid,
          displayName: authForm.name.trim(),
          name: authForm.name.trim(),
          email: cleanEmail,
          phone: authForm.phone.trim(),
          city: authForm.city.trim(),
          address: authForm.address.trim(),
          role: "customer",
        };

        try {
          localStorage.setItem(
            `megazone_profile_${cred.user.uid}`,
            JSON.stringify(profileData),
          );
        } catch {}

        // Safely write user document to Firestore for Admin Panel visibility without breaking Sign Up if rules deny
        if (db) {
          try {
            await setDoc(
              doc(db, "users", cred.user.uid),
              {
                ...profileData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch {
            // Firestore write is optional fallback; Auth account is already created
          }
        }

        showToast("Account created! Welcome to MEGAZONE Pakistan.");
        setAuthMessage("Your MEGAZONE account is ready!");
      }
    } catch (err: any) {
      const code = String(err?.code || "").toLowerCase();
      if (
        code.includes("invalid-credential") ||
        code.includes("wrong-password") ||
        code.includes("user-not-found") ||
        code.includes("invalid-login-credentials")
      ) {
        setAuthError(
          "Incorrect email or password. If you do not have an account yet, please switch to 'Create Account (Sign Up)'.",
        );
      } else if (code.includes("email-already-in-use")) {
        setAuthError("This email is already registered. Switching you to Login...");
        setAuthMode("login");
      } else if (code.includes("weak-password")) {
        setAuthError("Password should be at least 6 characters long.");
      } else if (code.includes("invalid-email")) {
        setAuthError("Please enter a valid email address (e.g., name@gmail.com).");
      } else if (code.includes("network-request-failed")) {
        setAuthError("Network error. Please check your internet connection and try again.");
      } else {
        setAuthError(err?.message || "Could not sign in right now. Please check your details.");
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // Handle Customer Profile Update
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    if (!currentUser) return;
    setAuthBusy(true);

    const updatedProfile = {
      displayName: authForm.name.trim(),
      name: authForm.name.trim(),
      email: currentUser.email || authForm.email.trim(),
      phone: authForm.phone.trim(),
      city: authForm.city.trim(),
      address: authForm.address.trim(),
    };

    try {
      localStorage.setItem(
        `megazone_profile_${currentUser.uid}`,
        JSON.stringify(updatedProfile),
      );
    } catch {}

    try {
      await updateProfile(currentUser, { displayName: authForm.name.trim() });
    } catch {}

    if (db) {
      try {
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            ...updatedProfile,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // Ignore if rules restrict user doc update; local profile is saved
      }
    }

    setCheckoutForm((prev) => ({
      ...prev,
      name: authForm.name.trim(),
      phone: authForm.phone.trim(),
      city: authForm.city.trim(),
      address: authForm.address.trim(),
    }));
    setAuthBusy(false);
    setAuthMessage("Delivery profile saved! Your details will auto-fill during checkout.");
    showToast("Profile & address updated");
  };

  // Handle Live Order Tracking Search
  const handleTrackOrderSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError("");
    setTrackedOrderResult(null);

    const qRaw = trackingQuery.trim();
    if (!qRaw) {
      setTrackingError("Please enter your Order Number (e.g. MZ-12345678) or Phone Number.");
      return;
    }

    const qNorm = qRaw.toLowerCase();
    // 1. Check in loaded userOrders + localOrders first
    const localMatch = allMyOrders.find(
      (o) =>
        o.orderNumber.toLowerCase() === qNorm ||
        o.id.toLowerCase() === qNorm ||
        (o.phone && o.phone.replace(/\s+/g, "").includes(qRaw.replace(/\s+/g, ""))),
    );

    if (localMatch) {
      setTrackedOrderResult(localMatch);
      return;
    }

    // 2. Query Firestore orders collection by orderNumber or phone if allowed
    if (configured && db) {
      setTrackingBusy(true);
      try {
        const byOrderNo = query(
          collection(db, "orders"),
          where("orderNumber", "==", qRaw.toUpperCase()),
        );
        const snap = await getDocs(byOrderNo);
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          const ts = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          setTrackedOrderResult({
            id: d.id,
            orderNumber: data.orderNumber || d.id,
            customerName: data.customerName || "",
            phone: data.phone || "",
            city: data.city || "",
            address: data.address || "",
            total: Number(data.total) || 0,
            paymentMethod: data.paymentMethod || "cod",
            paymentStatus: data.paymentStatus || "cod_due",
            orderStatus: data.orderStatus || "new",
            createdAtText: ts ? ts.toLocaleDateString("en-PK") : "Recent",
            items: Array.isArray(data.items) ? data.items : [],
          });
          setTrackingBusy(false);
          return;
        }
      } catch {
        // Fallback if query requires auth or index
      }
      setTrackingBusy(false);
    }

    setTrackingError(
      `No order found matching "${qRaw}". Please check your Order ID (e.g. MZ-...) or sign in with the account used to place the order.`,
    );
  };

  // Handle Become a Seller Submission (Saves to Firestore sellerApplications for Admin Panel approval)
  const handleSellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    setSellerSuccess("");

    if (!sellerForm.shopName.trim() || !sellerForm.ownerName.trim() || !sellerForm.phone.trim()) {
      setSellerError("Please enter your Shop Name, Owner Full Name, and Mobile/WhatsApp Number.");
      return;
    }
    if (sellerForm.plan === "lifetime_direct" && sellerForm.paymentReference.trim().length < 3) {
      setSellerError(
        "Please enter your payment transaction/reference ID (TID) for the one-time lifetime membership.",
      );
      return;
    }

    setSellerSubmitting(true);
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      let sellerUid = currentUser?.uid || `seller_${Date.now()}`;

      // If user is not logged in and provided email + password, create their Auth account first
      if (
        configured &&
        auth &&
        !currentUser &&
        sellerForm.email.trim() &&
        sellerForm.password.length >= 6
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            sellerForm.email.trim(),
            sellerForm.password,
          );
          await updateProfile(cred.user, { displayName: sellerForm.ownerName.trim() });
          sellerUid = cred.user.uid;
        } catch (authErr: any) {
          const code = String(authErr?.code || "");
          if (code.includes("email-already-in-use")) {
            const cred = await signInWithEmailAndPassword(
              auth,
              sellerForm.email.trim(),
              sellerForm.password,
            );
            sellerUid = cred.user.uid;
          } else {
            throw authErr;
          }
        }
      }

      const applicationPayload: SellerApplicationDoc = {
        uid: sellerUid,
        shopName: sellerForm.shopName.trim(),
        ownerName: sellerForm.ownerName.trim(),
        phone: sellerForm.phone.trim(),
        email: sellerForm.email.trim() || currentUser?.email || "",
        city: sellerForm.city.trim(),
        categoryFocus: sellerForm.categoryFocus,
        membershipPlan: sellerForm.plan,
        trialEndsAt: trialEnds.toISOString(),
        lifetimeFeeAmount: lifetimeFeeSetting,
        paymentStatus:
          sellerForm.plan === "trial_30_days" ? "free_trial_active" : "pending_verification",
        status: "pending",
      };

      if (configured && db) {
        // 1. Write to sellerApplications/{sellerUid} for Admin Panel review & approval
        try {
          await setDoc(
            doc(db, "sellerApplications", sellerUid),
            {
              ...applicationPayload,
              membershipType: "lifetime",
              freeTrialDays: 30,
              trialStartsAt: now.toISOString(),
              currency: "PKR",
              paymentReference: sellerForm.paymentReference.trim(),
              accountTitle: sellerForm.accountTitle.trim() || sellerForm.ownerName.trim(),
              easypaisa: sellerForm.easypaisa.trim(),
              jazzcash: sellerForm.jazzcash.trim(),
              bankName: sellerForm.bankName.trim(),
              bankAccount: sellerForm.bankAccount.trim(),
              adminPanelVisible: true,
              requestedRole: "seller",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {
          // Fallback to auto-ID document in sellerApplications if doc ID rule differs
          try {
            const fallbackRef = doc(collection(db, "sellerApplications"));
            await setDoc(fallbackRef, {
              ...applicationPayload,
              accountTitle: sellerForm.accountTitle.trim() || sellerForm.ownerName.trim(),
              easypaisa: sellerForm.easypaisa.trim(),
              jazzcash: sellerForm.jazzcash.trim(),
              bankAccount: sellerForm.bankAccount.trim(),
              paymentReference: sellerForm.paymentReference.trim(),
              createdAt: serverTimestamp(),
            });
          } catch {}
        }

        // 2. Also store seller payout details in settings/sellerPayment_{uid}
        try {
          await setDoc(
            doc(db, "settings", `sellerPayment_${sellerUid}`),
            {
              accountTitle: sellerForm.accountTitle.trim() || sellerForm.ownerName.trim(),
              easypaisa: sellerForm.easypaisa.trim(),
              jazzcash: sellerForm.jazzcash.trim(),
              bankName: sellerForm.bankName.trim(),
              bankAccount: sellerForm.bankAccount.trim(),
              instructions: `Official payout account for ${sellerForm.shopName.trim()}`,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {}

        // 3. Also sync sellerApplicationStatus on users/{uid} if permitted
        try {
          await setDoc(
            doc(db, "users", sellerUid),
            {
              uid: sellerUid,
              displayName: sellerForm.ownerName.trim(),
              email: sellerForm.email.trim() || currentUser?.email || "",
              phone: sellerForm.phone.trim(),
              city: sellerForm.city.trim(),
              shopName: sellerForm.shopName.trim(),
              sellerApplicationStatus: "pending",
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {}
      }

      setSellerApplication(applicationPayload);
      try {
        localStorage.setItem("megazone_seller_app", JSON.stringify(applicationPayload));
      } catch {}

      setSellerSuccess(
        `Your Seller Application for “${sellerForm.shopName.trim()}” has been sent to the MEGAZONE Admin Panel! Once the Admin approves your request and activates your Seller/Admin access, an official Approval Message will appear right here in your Profile.`,
      );
      showToast("Seller application sent to Admin Panel!");
    } catch (err: any) {
      setSellerError(
        err?.message || "Could not submit seller application right now. Please verify your details.",
      );
    } finally {
      setSellerSubmitting(false);
    }
  };

  // Handle Customer Order Placement
  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");
    if (!checkoutItems.length) return;
    if (!configured || !db || !functions) {
      setCheckoutError("Orders are temporarily unavailable. Please try again shortly.");
      return;
    }
    if (hasPhysical && (checkoutForm.city.trim().length < 2 || checkoutForm.address.trim().length < 8)) {
      setCheckoutError("Please enter your city and complete delivery address for physical products.");
      return;
    }
    if (hasGameTopUp && checkoutForm.playerId.trim().length < 3) {
      setCheckoutError("Please enter a valid game Player ID for your top-up.");
      return;
    }
    if (hasDigital && checkoutForm.payment === "cod") {
      setCheckoutError(
        "Cash on Delivery is available for physical products only. Please choose online transfer for digital products.",
      );
      return;
    }
    if (checkoutForm.payment !== "cod" && checkoutForm.paymentReference.trim().length < 3) {
      setCheckoutError(
        "Please enter your payment transaction/reference ID. Your payment will be verified before processing.",
      );
      return;
    }

    setPlacingOrder(true);
    const fallbackOrderNumber = `MZ-${Date.now().toString().slice(-8)}`;
    const normalizedItems = checkoutItems.map(({ product: p, quantity }) => ({
      productId: p.id,
      title: String(p.title ?? "Product").slice(0, 160),
      price: Number(p.price) || 0,
      quantity,
      type: p.type === "digital" ? "digital" : "physical",
      sellerId: p.sellerId,
      sellerName: String(p.sellerName ?? "Marketplace seller").slice(0, 100),
      gameTopUp: Boolean(p.gameTopUp),
      gameName: p.gameTopUp ? String(p.gameName ?? "").slice(0, 80) : "",
      gamePackage: p.gameTopUp ? String(p.gamePackage ?? "").slice(0, 100) : "",
    }));

    const orderPayload = {
      orderNumber: fallbackOrderNumber,
      customerName: checkoutForm.name.trim(),
      phone: checkoutForm.phone.trim(),
      email: checkoutForm.email.trim(),
      city: checkoutForm.city.trim(),
      address: checkoutForm.address.trim(),
      notes: checkoutForm.notes.trim(),
      playerId: checkoutForm.playerId.trim(),
      serverId: checkoutForm.serverId.trim(),
      gameUsername: checkoutForm.gameUsername.trim(),
      items: normalizedItems,
      total: checkoutTotal,
      currency: "PKR",
      paymentMethod: checkoutForm.payment,
      paymentReference: checkoutForm.paymentReference.trim(),
      paymentStatus: checkoutForm.payment === "cod" ? "cod_due" : "pending_verification",
      orderStatus: "new",
    };

    const saveLocalOrderRecord = (orderNo: string, totalAmt: number) => {
      const record: OrderRecord = {
        id: orderNo,
        orderNumber: orderNo,
        customerName: orderPayload.customerName,
        phone: orderPayload.phone,
        city: orderPayload.city,
        address: orderPayload.address,
        total: totalAmt,
        paymentMethod: orderPayload.paymentMethod,
        paymentStatus: orderPayload.paymentStatus,
        orderStatus: "new",
        createdAtText: new Date().toLocaleDateString("en-PK"),
        items: normalizedItems,
      };
      setLocalOrders((prev) => {
        const next = [record, ...prev];
        try {
          localStorage.setItem("megazone_my_orders", JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    try {
      const createOrder = httpsCallable(functions, "createOrder");
      const result: any = await createOrder({
        customerName: orderPayload.customerName,
        phone: orderPayload.phone,
        email: orderPayload.email,
        city: orderPayload.city,
        address: orderPayload.address,
        notes: orderPayload.notes,
        paymentMethod: orderPayload.paymentMethod,
        paymentReference: orderPayload.paymentReference,
        playerId: orderPayload.playerId,
        serverId: orderPayload.serverId,
        gameUsername: orderPayload.gameUsername,
        items: checkoutItems.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
      });
      const finalOrderNo = result?.data?.orderNumber || orderPayload.orderNumber;
      const finalTotal = result?.data?.total || orderPayload.total;
      saveLocalOrderRecord(finalOrderNo, finalTotal);
      setOrderSuccess(
        `Order ${finalOrderNo} confirmed for ${money(finalTotal)}. You can track live delivery progress anytime in the My Orders tab.`,
      );
      if (checkoutFromCart) setCart([]);
      setCheckoutItems([]);
    } catch (callableErr: any) {
      try {
        const batch = writeBatch(db);
        const orderRef = doc(collection(db, "orders"));
        batch.set(orderRef, {
          ...orderPayload,
          createdAt: serverTimestamp(),
          customerUid: currentUser?.uid ?? null,
        });

        const bySeller = new Map<string, typeof normalizedItems>();
        for (const item of normalizedItems) {
          const list = bySeller.get(item.sellerId) ?? [];
          list.push(item);
          bySeller.set(item.sellerId, list);
        }

        for (const [sellerId, sellerItems] of bySeller.entries()) {
          const sellerOrderRef = doc(db, "sellerOrders", `${orderRef.id}_${sellerId}`);
          batch.set(sellerOrderRef, {
            parentOrderId: orderRef.id,
            orderNumber: orderPayload.orderNumber,
            sellerId,
            customerName: orderPayload.customerName,
            phone: orderPayload.phone,
            city: orderPayload.city,
            address: orderPayload.address,
            notes: orderPayload.notes,
            playerId: orderPayload.playerId,
            serverId: orderPayload.serverId,
            gameUsername: orderPayload.gameUsername,
            items: sellerItems,
            total: sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
            currency: "PKR",
            paymentMethod: orderPayload.paymentMethod,
            paymentReference: orderPayload.paymentReference,
            paymentStatus: orderPayload.paymentStatus,
            orderStatus: "new",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        saveLocalOrderRecord(orderPayload.orderNumber, orderPayload.total);
        setOrderSuccess(
          `Order ${orderPayload.orderNumber} confirmed for ${money(orderPayload.total)}. You can track live delivery progress anytime in the My Orders tab.`,
        );
        if (checkoutFromCart) setCart([]);
        setCheckoutItems([]);
      } catch {
        const msg =
          typeof callableErr?.message === "string" &&
          !callableErr.message.toLowerCase().includes("internal")
            ? callableErr.message
            : "Order could not be submitted. Please check your connection or try again.";
        setCheckoutError(msg);
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="app-shell">
      {/* Top Pakistani Flag Green Strip (Clean customer links — No "Become Seller" clutter at top) */}
      <div className="promo-strip">
        <div className="promo-strip-inner">
          <span>
            ☪ Pakistan’s Official White &amp; Green Marketplace · Nationwide COD &amp; Instant Game Top-Ups
          </span>
          <div className="promo-links">
            <button type="button" onClick={() => setActiveTab("categories")}>
              Browse Categories
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setActiveTab("orders")}>
              Track My Orders {allMyOrders.length > 0 ? `(${allMyOrders.length})` : ""}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setProfileSection("account");
                setActiveTab("profile");
              }}
            >
              {currentUser
                ? `Hi, ${authForm.name || currentUser.displayName || currentUser.email?.split("@")[0]}`
                : "Sign In / Create Account"}
            </button>
          </div>
        </div>
      </div>

      {/* Strict 3-Zone Top Bar Contract (4 Core Marketplace Tabs: Home, Categories, My Orders, User Profile + Cart CTA) */}
      <header className="topbar">
        <div className="topbar-inner">
          {/* Zone 1: Pakistani Flag Emblem + Brand Wordmark */}
          <a
            href="#top"
            className="brand-wordmark"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("home");
              setActiveCategory("All");
              setTypeFilter("all");
              setSearchQuery("");
            }}
          >
            <span className="brand-flag-mark" aria-hidden="true">
              ☪
            </span>
            MEGA<span>ZONE</span>
          </a>

          {/* Zone 2: Clean 4-Tab Marketplace Navigation (Home, Categories, My Orders, User Profile) */}
          <nav className="topbar-nav" aria-label="Main Marketplace Navigation">
            <button
              type="button"
              className={`topbar-link ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              Home
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "categories" ? "active" : ""}`}
              onClick={() => setActiveTab("categories")}
            >
              Categories
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              My Orders &amp; Track {allMyOrders.length > 0 ? `(${allMyOrders.length})` : ""}
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              {currentUser ? "User Profile" : "Account / Sign In"}
            </button>
          </nav>

          {/* Zone 3: Primary Cart CTA */}
          <button type="button" className="topbar-cta" onClick={openCartCheckout}>
            <ShoppingBag size={16} />
            <span>Cart</span>
            <span className="topbar-cta-count">{totalCartCount}</span>
          </button>
        </div>
      </header>

      {/* Search Bar + Category Filter Bar */}
      <div className="marketplace-search-bar">
        <div className="marketplace-search-inner">
          <form
            className="search-box-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              scrollToCatalog();
            }}
          >
            <input
              className="search-box-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== "home" && activeTab !== "categories") {
                  setActiveTab("home");
                }
              }}
              placeholder="Search in MEGAZONE Pakistan — e.g. Earbuds, PUBG UC, Free Fire Diamonds, Watches..."
              aria-label="Search in MEGAZONE"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-box-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <button type="submit" className="search-box-submit">
              <Search size={16} /> Search
            </button>
          </form>

          <div className="quick-search-tags" aria-label="Popular categories">
            {["All", ...categories].map((c) => (
              <button
                type="button"
                key={c}
                className={`quick-tag-btn ${activeCategory === c && (activeTab === "home" || activeTab === "categories") ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(c);
                  if (c === "Digital Products") {
                    setTypeFilter("digital");
                  } else if (typeFilter === "digital" && c !== "Gaming") {
                    setTypeFilter("all");
                  }
                  if (activeTab !== "home" && activeTab !== "categories") {
                    setActiveTab("home");
                  }
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Admin Approval Notification Banner (Shown automatically when Admin approves the user as Seller/Admin) */}
      {isSellerApproved && (
        <div
          style={{
            background: "linear-gradient(90deg, #01411c 0%, #006b3f 100%)",
            color: "#ffffff",
            padding: "10px 16px",
            borderBottom: "1px solid #008751",
          }}
        >
          <div
            style={{
              maxWidth: 1360,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 13,
            }}
          >
            <span>
              <strong>🎉 Seller Account Approved by Admin!</strong> Congratulations{" "}
              {sellerApplication?.ownerName || authForm.name || currentUser?.displayName || "Partner"} — your store{" "}
              <strong>{sellerApplication?.shopName || "MEGAZONE Seller Shop"}</strong> is now active with{" "}
              {userRole === "super_admin" || userRole === "admin" ? "Admin & Seller" : "Verified Seller"} privileges.
            </span>
            <button
              type="button"
              onClick={() => openProfileSection("seller")}
              style={{
                background: "#ffffff",
                color: "#01411c",
                border: 0,
                borderRadius: 6,
                padding: "5px 12px",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              View Seller Status
            </button>
          </div>
        </div>
      )}

      <main className="main-container" id="top">
        {/* =========================================================
            TAB 1: HOME (Hero Bento + Guarantee Bar + Departments + Product Grid)
           ========================================================= */}
        {activeTab === "home" && (
          <>
            <section className="hero-section">
              <div className="hero-bento">
                <div className="hero-carousel">
                  <div className="hero-slide" key={currentSlide.id}>
                    <img
                      className="hero-slide-img"
                      src={currentSlide.image}
                      alt={currentSlide.title}
                      referrerPolicy="no-referrer"
                    />
                    <div className="hero-slide-scrim">
                      <span className="hero-kicker">{currentSlide.kicker}</span>
                      <h1>{currentSlide.title}</h1>
                      <p>{currentSlide.subtitle}</p>
                      <div className="hero-slide-actions">
                        <button
                          type="button"
                          className="btn-white-green"
                          onClick={() => {
                            setActiveCategory(currentSlide.category);
                            setTypeFilter(currentSlide.typeFilter);
                            scrollToCatalog();
                          }}
                        >
                          {currentSlide.ctaText} <ArrowRight size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-outline-light"
                          onClick={() => setActiveTab("orders")}
                        >
                          Track My Order
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="carousel-controls" role="tablist" aria-label="Hero slides">
                    {HERO_SLIDES.map((s, idx) => (
                      <button
                        type="button"
                        key={s.id}
                        className={`carousel-dot ${activeSlide === idx ? "active" : ""}`}
                        aria-label={`Show slide ${idx + 1}`}
                        onClick={() => setActiveSlide(idx)}
                      />
                    ))}
                  </div>
                </div>

                <div className="hero-side-stack">
                  <article
                    className="side-promo-card"
                    onClick={() => {
                      setActiveCategory("Gaming");
                      setTypeFilter("all");
                      scrollToCatalog();
                    }}
                  >
                    <img
                      src={gamingImg}
                      alt="Gaming Top-Ups — PUBG UC & Free Fire Diamonds"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="side-promo-scrim">
                      <small>INSTANT PLAYER ID TOP-UP</small>
                      <h3>PUBG UC, Free Fire &amp; Ludo Star</h3>
                      <span>
                        Top-Up Now <ArrowRight size={14} />
                      </span>
                    </div>
                  </article>

                  <article
                    className="side-promo-card"
                    onClick={() => {
                      setActiveCategory("Digital Products");
                      setTypeFilter("digital");
                      scrollToCatalog();
                    }}
                  >
                    <img
                      src={digitalImg}
                      alt="Digital Creator Assets & Downloads"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="side-promo-scrim">
                      <small>DIGITAL MARKETPLACE</small>
                      <h3>Software, Templates &amp; Guides</h3>
                      <span>
                        Explore Digital <ArrowRight size={14} />
                      </span>
                    </div>
                  </article>
                </div>
              </div>

              <div className="guarantee-strip">
                <div className="guarantee-item">
                  <div className="guarantee-icon">
                    <Truck size={20} />
                  </div>
                  <div>
                    <strong>Nationwide COD</strong>
                    <span>Cash on Delivery across Pakistan</span>
                  </div>
                </div>
                <div className="guarantee-item">
                  <div className="guarantee-icon">
                    <BadgeCheck size={20} />
                  </div>
                  <div>
                    <strong>Verified Pakistani Stores</strong>
                    <span>Authentic sellers &amp; direct support</span>
                  </div>
                </div>
                <div className="guarantee-item">
                  <div className="guarantee-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <strong>Easypaisa &amp; JazzCash</strong>
                    <span>Safe local wallet &amp; bank transfer</span>
                  </div>
                </div>
                <div className="guarantee-item">
                  <div className="guarantee-icon">
                    <RotateCcw size={20} />
                  </div>
                  <div>
                    <strong>Live Order Tracker</strong>
                    <span>Real-time status from packing to door</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Shop by Department */}
            <section className="department-section">
              <div className="section-bar">
                <div>
                  <h2>Shop by Department</h2>
                  <p>Browse physical goods, instant game top-ups, and digital downloads</p>
                </div>
                <button
                  type="button"
                  className="btn-cart"
                  onClick={() => setActiveTab("categories")}
                >
                  <LayoutGrid size={15} />
                  <span>View All Categories</span>
                </button>
              </div>
              <div className="dept-grid">
                {DEPARTMENT_TILES.map((dept) => {
                  const Icon = dept.icon;
                  const isActive = activeCategory === dept.name;
                  return (
                    <button
                      type="button"
                      key={dept.name}
                      className={`dept-card ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveCategory(dept.name);
                        setTypeFilter(dept.name === "Digital Products" ? "digital" : "all");
                        scrollToCatalog();
                      }}
                    >
                      <div className="dept-icon">
                        <Icon size={22} />
                      </div>
                      <strong>{dept.name}</strong>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 3: Live Marketplace Catalog */}
            <section className="catalog-section" ref={catalogSectionRef}>
              <div className="section-bar">
                <div>
                  <h2>
                    {activeCategory === "All" ? "Featured Products & Deals" : activeCategory}
                  </h2>
                  <p>
                    Showing {visible.length}{" "}
                    {visible.length === 1 ? "verified product" : "verified products"}
                    {searchQuery ? ` for “${searchQuery}”` : ""}
                  </p>
                </div>
              </div>

              <div className="catalog-toolbar">
                <div className="segmented-group" role="tablist" aria-label="Product delivery type">
                  <button
                    type="button"
                    className={`segmented-btn ${typeFilter === "all" ? "active" : ""}`}
                    onClick={() => setTypeFilter("all")}
                  >
                    All Items
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${typeFilter === "physical" ? "active" : ""}`}
                    onClick={() => setTypeFilter("physical")}
                  >
                    Physical (COD)
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${typeFilter === "digital" ? "active" : ""}`}
                    onClick={() => setTypeFilter("digital")}
                  >
                    Digital &amp; Top-Ups
                  </button>
                </div>

                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>

              {loadingCatalog ? (
                <div className="empty-catalog">
                  <h3>Loading deals for you…</h3>
                  <p>Fetching the latest products from MEGAZONE sellers.</p>
                </div>
              ) : visible.length > 0 ? (
                <div className="product-grid">
                  {visible.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAdd={add}
                      onBuy={buyNow}
                      onWishlist={toggleWishlist}
                      onQuickView={(item) => setQuickViewProduct(item)}
                      isWishlisted={wishlistIds.includes(p.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-catalog">
                  <Search size={30} color="#01411c" />
                  <h3>
                    {searchQuery || activeCategory !== "All" || typeFilter !== "all"
                      ? "No matching products found"
                      : "New seller arrivals coming soon"}
                  </h3>
                  <p>
                    {searchQuery || activeCategory !== "All" || typeFilter !== "all"
                      ? "Try clearing your search or selecting another category to explore more items."
                      : "Verified sellers are adding fresh products to MEGAZONE Pakistan."}
                  </p>
                  {(searchQuery || activeCategory !== "All" || typeFilter !== "all") && (
                    <button
                      type="button"
                      className="btn-green-solid"
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("All");
                        setTypeFilter("all");
                      }}
                    >
                      View All Products
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* =========================================================
            TAB 2: CATEGORIES EXPLORER (Daraz-Style Department Directory + Filtered Grid)
           ========================================================= */}
        {activeTab === "categories" && (
          <section className="tab-page-section">
            <div className="section-bar">
              <div>
                <h2>MEGAZONE Categories Directory</h2>
                <p>Select any department or game top-up category to filter products immediately</p>
              </div>
              {activeCategory !== "All" && (
                <button
                  type="button"
                  className="btn-cart"
                  onClick={() => {
                    setActiveCategory("All");
                    setTypeFilter("all");
                  }}
                >
                  Show All Categories
                </button>
              )}
            </div>

            <div className="dept-grid" style={{ marginBottom: 24 }}>
              {DEPARTMENT_TILES.map((dept) => {
                const Icon = dept.icon;
                const isActive = activeCategory === dept.name;
                return (
                  <button
                    type="button"
                    key={dept.name}
                    className={`dept-card ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setActiveCategory(dept.name);
                      setTypeFilter(dept.name === "Digital Products" ? "digital" : "all");
                    }}
                  >
                    <div className="dept-icon">
                      <Icon size={22} />
                    </div>
                    <strong>{dept.name}</strong>
                    <span style={{ fontSize: 11, color: "#647a6d" }}>{dept.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="catalog-toolbar">
              <div className="segmented-group">
                {["All", ...categories].map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`segmented-btn ${activeCategory === c ? "active" : ""}`}
                    onClick={() => setActiveCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>

            {visible.length > 0 ? (
              <div className="product-grid">
                {visible.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAdd={add}
                    onBuy={buyNow}
                    onWishlist={toggleWishlist}
                    onQuickView={(item) => setQuickViewProduct(item)}
                    isWishlisted={wishlistIds.includes(p.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-catalog">
                <LayoutGrid size={30} color="#01411c" />
                <h3>No products in “{activeCategory}” yet</h3>
                <p>Choose another category above or check back soon for new arrivals.</p>
                <button
                  type="button"
                  className="btn-green-solid"
                  onClick={() => {
                    setActiveCategory("All");
                    setTypeFilter("all");
                  }}
                >
                  Browse All Categories
                </button>
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            TAB 3: MY ORDERS & LIVE ORDER TRACKING SYSTEM
           ========================================================= */}
        {activeTab === "orders" && (
          <section className="tab-page-section">
            <div className="tracker-search-card">
              <div className="section-bar" style={{ marginBottom: 6 }}>
                <div>
                  <h2>Track Your MEGAZONE Order</h2>
                  <p>
                    Enter your Order ID (e.g. <strong>MZ-12345678</strong>) or Mobile Number to see real-time packing, shipping, and delivery progress.
                  </p>
                </div>
              </div>

              <form className="tracker-search-form" onSubmit={handleTrackOrderSearch}>
                <input
                  value={trackingQuery}
                  onChange={(e) => setTrackingQuery(e.target.value)}
                  placeholder="Enter Order ID (MZ-...) or Mobile Number (03XX...)"
                  aria-label="Order ID or Phone Number"
                />
                <button type="submit" className="btn-green-solid" disabled={trackingBusy}>
                  <Truck size={16} />
                  <span>{trackingBusy ? "Searching…" : "Track Order"}</span>
                </button>
                {trackedOrderResult && (
                  <button
                    type="button"
                    className="btn-cart"
                    onClick={() => {
                      setTrackedOrderResult(null);
                      setTrackingQuery("");
                    }}
                  >
                    Clear
                  </button>
                )}
              </form>

              {trackingError && <div className="checkout-error">{trackingError}</div>}

              {trackedOrderResult && (
                <div style={{ marginTop: 20 }}>
                  <article className="order-card" style={{ borderColor: "#006b3f" }}>
                    <div className="order-card-head">
                      <strong>Tracking Order #{trackedOrderResult.orderNumber}</strong>
                      <div className="order-card-meta">
                        <span>Placed: {trackedOrderResult.createdAtText}</span>
                        <span>·</span>
                        <span>
                          Payment: {trackedOrderResult.paymentStatus.replace("_", " ").toUpperCase()}
                        </span>
                        <span>·</span>
                        <strong>{money(trackedOrderResult.total)}</strong>
                      </div>
                    </div>

                    <div className="order-stepper">
                      {ORDER_STEPS.map((st, idx) => {
                        const currentIdx = getOrderStepIndex(trackedOrderResult.orderStatus);
                        const isDone = idx <= currentIdx;
                        return (
                          <div key={st.key} className={`step-node ${isDone ? "done" : ""}`}>
                            <div className="step-circle">{isDone ? "✓" : idx + 1}</div>
                            <span>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="order-card-items">
                      {trackedOrderResult.items.map((item, idx) => (
                        <div
                          key={`${trackedOrderResult.id}-track-${idx}`}
                          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                        >
                          <span>
                            {item.title} × {item.quantity || 1} ({item.sellerName})
                          </span>
                          <strong className="tabular-nums">
                            {money((item.price || 0) * (item.quantity || 1))}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              )}
            </div>

            <div className="section-bar">
              <div>
                <h2>My Orders History ({allMyOrders.length})</h2>
                <p>All orders placed from this device or your signed-in MEGAZONE account</p>
              </div>
            </div>

            {allMyOrders.length === 0 ? (
              <div className="empty-catalog">
                <ClipboardList size={32} color="#01411c" />
                <h3>You haven’t placed any orders yet</h3>
                <p>
                  Once you buy a physical item, game top-up, or digital product, live step-by-step tracking will appear right here.
                </p>
                <button
                  type="button"
                  className="btn-green-solid"
                  onClick={() => setActiveTab("home")}
                >
                  Start Shopping <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {allMyOrders.map((ord) => {
                  const stepIdx = getOrderStepIndex(ord.orderStatus);
                  return (
                    <article className="order-card" key={ord.id}>
                      <div className="order-card-head">
                        <strong>Order #{ord.orderNumber}</strong>
                        <div className="order-card-meta">
                          <span>Date: {ord.createdAtText}</span>
                          <span>·</span>
                          <span>Status: {ord.orderStatus.toUpperCase()}</span>
                          <span>·</span>
                          <span>
                            Payment: {ord.paymentStatus.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 5-Stage Visual Order Progress Stepper */}
                      <div className="order-stepper">
                        {ORDER_STEPS.map((st, idx) => {
                          const isDone = idx <= stepIdx;
                          return (
                            <div key={st.key} className={`step-node ${isDone ? "done" : ""}`}>
                              <div className="step-circle">{isDone ? "✓" : idx + 1}</div>
                              <span>{st.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="order-card-items">
                        {ord.items.map((item, idx) => (
                          <div
                            key={`${ord.id}-${idx}`}
                            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                          >
                            <span>
                              {item.title} × {item.quantity || 1} ({item.sellerName})
                            </span>
                            <strong className="tabular-nums">
                              {money((item.price || 0) * (item.quantity || 1))}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: "1px solid #dce7e0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                          fontSize: 13.5,
                        }}
                      >
                        <span>
                          Method:{" "}
                          {ord.paymentMethod === "cod" ? "Cash on Delivery" : "Online Transfer"}
                          {ord.city ? ` · Delivery to ${ord.city}` : ""}
                        </span>
                        <strong className="tabular-nums" style={{ color: "#01411c", fontSize: 16 }}>
                          Total: {money(ord.total)}
                        </strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            TAB 4: DARAZ-STYLE USER PROFILE & SETTINGS HUB
            (Includes Account Auth/Profile, Saved Wishlist, & Become a Seller Settings)
           ========================================================= */}
        {activeTab === "profile" && (
          <section className="tab-page-section">
            <div className="profile-layout">
              {/* Left Sidebar: Daraz-Style User Card & Settings Navigation */}
              <aside className="profile-sidebar-card">
                <div className="profile-hero-banner">
                  <div className="profile-avatar">
                    {(authForm.name || currentUser?.displayName || currentUser?.email || "M")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <h3>
                    {currentUser
                      ? authForm.name || currentUser.displayName || "MEGAZONE Member"
                      : "Welcome to MEGAZONE"}
                  </h3>
                  <p>
                    {currentUser
                      ? currentUser.email
                      : "Sign in to sync your profile, orders & seller settings"}
                  </p>
                  {isSellerApproved && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#9ef0c4",
                      }}
                    >
                      <CheckCircle2 size={15} /> Approved Seller / Admin Partner
                    </div>
                  )}
                </div>

                <div className="profile-menu-list">
                  <button
                    type="button"
                    className={`profile-menu-item ${profileSection === "account" ? "active" : ""}`}
                    onClick={() => setProfileSection("account")}
                  >
                    <div className="profile-menu-left">
                      <div className="profile-menu-icon">
                        <UserRound size={18} />
                      </div>
                      <div>
                        <strong>
                          {currentUser ? "Account & Delivery Settings" : "Sign In / Sign Up"}
                        </strong>
                        <small>Name, mobile number &amp; default delivery address</small>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#647a6d" />
                  </button>

                  <button
                    type="button"
                    className={`profile-menu-item ${profileSection === "wishlist" ? "active" : ""}`}
                    onClick={() => setProfileSection("wishlist")}
                  >
                    <div className="profile-menu-left">
                      <div className="profile-menu-icon">
                        <Heart size={18} />
                      </div>
                      <div>
                        <strong>Saved Wishlist ({wishlistIds.length})</strong>
                        <small>Products you saved for quick buying</small>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#647a6d" />
                  </button>

                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => setActiveTab("orders")}
                  >
                    <div className="profile-menu-left">
                      <div className="profile-menu-icon">
                        <ClipboardList size={18} />
                      </div>
                      <div>
                        <strong>My Orders &amp; Live Tracking ({allMyOrders.length})</strong>
                        <small>Track packages &amp; view order history</small>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#647a6d" />
                  </button>

                  <button
                    type="button"
                    className={`profile-menu-item ${profileSection === "seller" ? "active" : ""}`}
                    onClick={() => setProfileSection("seller")}
                  >
                    <div className="profile-menu-left">
                      <div className="profile-menu-icon">
                        <Store size={18} />
                      </div>
                      <div>
                        <strong>
                          {isSellerApproved
                            ? "Seller Center (Approved ✓)"
                            : sellerApplication?.status === "pending"
                              ? "Become a Seller (Pending Admin Review)"
                              : "Become a Seller (Settings)"}
                        </strong>
                        <small>1-Month Free Trial · Then 1-Time Lifetime Fee</small>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#647a6d" />
                  </button>

                  {currentUser && (
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={async () => {
                        if (auth) await signOut(auth);
                        showToast("Signed out of MEGAZONE");
                      }}
                    >
                      <div className="profile-menu-left">
                        <div className="profile-menu-icon" style={{ color: "#b42318" }}>
                          <LogOut size={18} />
                        </div>
                        <div>
                          <strong style={{ color: "#b42318" }}>Sign Out</strong>
                          <small>Log out of your account on this device</small>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </aside>

              {/* Right Content Area */}
              <div className="profile-content-card">
                {/* 1. Official Seller Approval Banner inside User Profile if Admin Approved */}
                {isSellerApproved && (
                  <div className="seller-approved-banner">
                    <small style={{ fontWeight: 700, color: "#9ef0c4" }}>
                      ☪ OFFICIAL ADMIN APPROVAL NOTIFICATION
                    </small>
                    <h3>
                      Congratulations! Your Seller Account Has Been Approved by MEGAZONE Admin
                    </h3>
                    <p>
                      Your shop{" "}
                      <strong>{sellerApplication?.shopName || "MEGAZONE Partner Store"}</strong> is
                      now officially verified and your account has been granted{" "}
                      <strong>
                        {userRole === "super_admin" || userRole === "admin"
                          ? "Admin & Seller"
                          : "Seller"}
                      </strong>{" "}
                      permissions. You can now log in to the MEGAZONE Admin / Seller Panel using
                      your registered email (<strong>{currentUser?.email || sellerApplication?.email}</strong>) to upload and manage your products!
                    </p>
                  </div>
                )}

                {/* SUB-VIEW A: Account Sign In / Sign Up / Delivery Profile */}
                {profileSection === "account" && (
                  <>
                    {!currentUser ? (
                      <form onSubmit={handleAuthSubmit}>
                        <div className="section-bar" style={{ marginBottom: 16 }}>
                          <div>
                            <h2>
                              {authMode === "login"
                                ? "Sign In to MEGAZONE Pakistan"
                                : authMode === "signup"
                                  ? "Create Your MEGAZONE Account"
                                  : "Reset Your Password"}
                            </h2>
                            <p>
                              Access your saved delivery address, order tracking, and Seller Center settings.
                            </p>
                          </div>
                        </div>

                        <div className="segmented-group" style={{ marginBottom: 20 }}>
                          <button
                            type="button"
                            className={`segmented-btn ${authMode === "login" ? "active" : ""}`}
                            onClick={() => {
                              setAuthMode("login");
                              setAuthError("");
                              setAuthMessage("");
                            }}
                          >
                            Login
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn ${authMode === "signup" ? "active" : ""}`}
                            onClick={() => {
                              setAuthMode("signup");
                              setAuthError("");
                              setAuthMessage("");
                            }}
                          >
                            Create Account (Sign Up)
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn ${authMode === "reset" ? "active" : ""}`}
                            onClick={() => {
                              setAuthMode("reset");
                              setAuthError("");
                              setAuthMessage("");
                            }}
                          >
                            Forgot Password
                          </button>
                        </div>

                        <div className="checkout-field-grid">
                          {authMode === "signup" && (
                            <>
                              <label>
                                Full Name *
                                <input
                                  required
                                  value={authForm.name}
                                  onChange={(e) =>
                                    setAuthForm({ ...authForm, name: e.target.value })
                                  }
                                  placeholder="Enter your full name"
                                />
                              </label>
                              <label>
                                Mobile Number *
                                <input
                                  required
                                  type="tel"
                                  value={authForm.phone}
                                  onChange={(e) =>
                                    setAuthForm({ ...authForm, phone: e.target.value })
                                  }
                                  placeholder="03XX XXXXXXX"
                                />
                              </label>
                            </>
                          )}
                          <label className={authMode === "reset" ? "field-full" : ""}>
                            Email Address *
                            <input
                              required
                              type="email"
                              value={authForm.email}
                              onChange={(e) =>
                                setAuthForm({ ...authForm, email: e.target.value })
                              }
                              placeholder="you@example.com"
                            />
                          </label>
                          {authMode !== "reset" && (
                            <label>
                              Password *
                              <input
                                required
                                type="password"
                                minLength={6}
                                value={authForm.password}
                                onChange={(e) =>
                                  setAuthForm({ ...authForm, password: e.target.value })
                                }
                                placeholder="Minimum 6 characters"
                              />
                            </label>
                          )}
                          {authMode === "signup" && (
                            <>
                              <label>
                                City
                                <input
                                  value={authForm.city}
                                  onChange={(e) =>
                                    setAuthForm({ ...authForm, city: e.target.value })
                                  }
                                  placeholder="Karachi, Lahore, Islamabad..."
                                />
                              </label>
                              <label>
                                Default Delivery Address
                                <input
                                  value={authForm.address}
                                  onChange={(e) =>
                                    setAuthForm({ ...authForm, address: e.target.value })
                                  }
                                  placeholder="House #, Street, Area"
                                />
                              </label>
                            </>
                          )}
                        </div>

                        {authError && <div className="checkout-error">{authError}</div>}
                        {authMessage && (
                          <div className="summary-safe" style={{ marginTop: 12 }}>
                            {authMessage}
                          </div>
                        )}

                        <button type="submit" className="checkout-submit" disabled={authBusy}>
                          {authBusy
                            ? "Please wait…"
                            : authMode === "login"
                              ? "Sign In to My Account"
                              : authMode === "signup"
                                ? "Create My MEGAZONE Account"
                                : "Send Password Reset Link"}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleProfileSave}>
                        <div className="section-bar" style={{ marginBottom: 18 }}>
                          <div>
                            <h2>My Account &amp; Delivery Settings</h2>
                            <p>
                              Keep your mobile number and delivery address updated for 1-click checkout.
                            </p>
                          </div>
                        </div>

                        <div className="checkout-field-grid">
                          <label>
                            Full Name
                            <input
                              value={authForm.name}
                              onChange={(e) =>
                                setAuthForm({ ...authForm, name: e.target.value })
                              }
                              placeholder="Your full name"
                            />
                          </label>
                          <label>
                            Mobile / WhatsApp Number
                            <input
                              type="tel"
                              value={authForm.phone}
                              onChange={(e) =>
                                setAuthForm({ ...authForm, phone: e.target.value })
                              }
                              placeholder="03XX XXXXXXX"
                            />
                          </label>
                          <label>
                            City
                            <input
                              value={authForm.city}
                              onChange={(e) =>
                                setAuthForm({ ...authForm, city: e.target.value })
                              }
                              placeholder="Karachi, Lahore, Islamabad..."
                            />
                          </label>
                          <label>
                            Registered Email
                            <input value={currentUser.email || ""} disabled />
                          </label>
                          <label className="field-full">
                            Complete Delivery Address (Auto-fills at Checkout)
                            <textarea
                              rows={3}
                              value={authForm.address}
                              onChange={(e) =>
                                setAuthForm({ ...authForm, address: e.target.value })
                              }
                              placeholder="House #, Street, Sector / Area, Nearest Landmark"
                            />
                          </label>
                        </div>

                        {authError && <div className="checkout-error">{authError}</div>}
                        {authMessage && (
                          <div className="summary-safe" style={{ marginTop: 12 }}>
                            {authMessage}
                          </div>
                        )}

                        <button type="submit" className="checkout-submit" disabled={authBusy}>
                          {authBusy ? "Saving Settings…" : "Save Profile & Delivery Settings"}
                        </button>
                      </form>
                    )}
                  </>
                )}

                {/* SUB-VIEW B: Saved Wishlist inside User Profile */}
                {profileSection === "wishlist" && (
                  <div>
                    <div className="section-bar" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>My Saved Wishlist ({wishlistedProducts.length})</h2>
                        <p>Products you bookmarked while browsing MEGAZONE</p>
                      </div>
                    </div>

                    {wishlistedProducts.length === 0 ? (
                      <div className="empty-catalog" style={{ marginTop: 0 }}>
                        <Heart size={30} color="#01411c" />
                        <h3>Your wishlist is empty</h3>
                        <p>
                          Tap the heart icon on any product card to save it here for later.
                        </p>
                        <button
                          type="button"
                          className="btn-green-solid"
                          onClick={() => setActiveTab("home")}
                        >
                          Explore Products
                        </button>
                      </div>
                    ) : (
                      <div className="product-grid">
                        {wishlistedProducts.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            onAdd={add}
                            onBuy={buyNow}
                            onWishlist={toggleWishlist}
                            onQuickView={(item) => setQuickViewProduct(item)}
                            isWishlisted={true}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-VIEW C: Daraz-Style Become a Seller Settings & Admin Approval Status */}
                {profileSection === "seller" && (
                  <div>
                    <div className="section-bar" style={{ marginBottom: 16 }}>
                      <div>
                        <h2>MEGAZONE Seller Center &amp; Registration</h2>
                        <p>
                          Start with a 1-Month Free Seller Trial. Satisfied after 30 days? Pay a one-time fee ({money(lifetimeFeeSetting)}) for lifetime product listings!
                        </p>
                      </div>
                    </div>

                    {/* Show Pending Review Banner if user already applied and is waiting for Admin Panel approval */}
                    {sellerApplication && !isSellerApproved && (
                      <div className="seller-pending-banner">
                        <h4>
                          ⏳ Application Status: Under Admin Review ({sellerApplication.shopName})
                        </h4>
                        <p>
                          Your seller application for <strong>{sellerApplication.shopName}</strong>{" "}
                          (Owner: {sellerApplication.ownerName} · Phone: {sellerApplication.phone}) has been sent to the{" "}
                          <strong>MEGAZONE Admin Panel</strong>. As soon as the Admin approves your request and upgrades your account, your official{" "}
                          <strong>Seller Approval Message</strong> will appear right here!
                        </p>
                      </div>
                    )}

                    {sellerSuccess ? (
                      <div className="order-success">
                        <div className="success-check">✓</div>
                        <h3>Sent to MEGAZONE Admin Panel!</h3>
                        <p>{sellerSuccess}</p>
                        <button
                          type="button"
                          className="checkout-submit"
                          onClick={() => setSellerSuccess("")}
                        >
                          View My Seller Settings
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSellerSubmit}>
                        <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                          1. Select Your Seller Package
                        </h3>
                        <div className="seller-plan-grid">
                          <div
                            className={`seller-plan-card ${sellerForm.plan === "trial_30_days" ? "selected" : ""}`}
                            onClick={() => setSellerForm({ ...sellerForm, plan: "trial_30_days" })}
                          >
                            <small>MOST POPULAR · DARAZ-STYLE ONBOARDING</small>
                            <h4>1-Month Free Trial (Rs. 0 Today)</h4>
                            <p>
                              Run your shop free for 30 days. After 1 month, pay the one-time{" "}
                              <strong>{money(lifetimeFeeSetting)}</strong> fee to keep listing products for life!
                            </p>
                          </div>

                          <div
                            className={`seller-plan-card ${sellerForm.plan === "lifetime_direct" ? "selected" : ""}`}
                            onClick={() =>
                              setSellerForm({ ...sellerForm, plan: "lifetime_direct" })
                            }
                          >
                            <small>ONE-TIME FEE · LIFETIME ACCESS</small>
                            <h4>Direct Lifetime Seller ({money(lifetimeFeeSetting)})</h4>
                            <p>
                              Pay once and list unlimited physical products, game top-ups, or digital items forever with zero monthly rent.
                            </p>
                          </div>
                        </div>

                        <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                          2. Shop &amp; Owner Information (Sent to Admin Panel)
                        </h3>
                        <div className="checkout-field-grid">
                          <label>
                            Shop / Store Name *
                            <input
                              required
                              value={sellerForm.shopName}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, shopName: e.target.value })
                              }
                              placeholder="e.g. Pak Tech Store / Lahore Fashion"
                            />
                          </label>
                          <label>
                            Owner Full Name *
                            <input
                              required
                              value={sellerForm.ownerName}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, ownerName: e.target.value })
                              }
                              placeholder="Your full name"
                            />
                          </label>
                          <label>
                            Mobile / WhatsApp Number *
                            <input
                              required
                              type="tel"
                              value={sellerForm.phone}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, phone: e.target.value })
                              }
                              placeholder="03XX XXXXXXX"
                            />
                          </label>
                          <label>
                            City *
                            <input
                              required
                              value={sellerForm.city}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, city: e.target.value })
                              }
                              placeholder="Karachi, Lahore, Islamabad..."
                            />
                          </label>
                          {!currentUser && (
                            <>
                              <label>
                                Seller Login Email *
                                <input
                                  required
                                  type="email"
                                  value={sellerForm.email}
                                  onChange={(e) =>
                                    setSellerForm({ ...sellerForm, email: e.target.value })
                                  }
                                  placeholder="shop@example.com"
                                />
                              </label>
                              <label>
                                Seller Account Password *
                                <input
                                  required
                                  type="password"
                                  minLength={6}
                                  value={sellerForm.password}
                                  onChange={(e) =>
                                    setSellerForm({ ...sellerForm, password: e.target.value })
                                  }
                                  placeholder="Minimum 6 characters"
                                />
                              </label>
                            </>
                          )}
                          <label className="field-full">
                            Primary Product Category
                            <select
                              value={sellerForm.categoryFocus}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, categoryFocus: e.target.value })
                              }
                            >
                              <option value="Physical & Digital Products">
                                Both Physical (COD) &amp; Digital Products
                              </option>
                              <option value="Physical Products (COD)">
                                Physical Products Only (Cash on Delivery)
                              </option>
                              <option value="Game Top-Ups (PUBG / Free Fire / Ludo)">
                                Game Top-Ups (PUBG UC, Free Fire Diamonds, Ludo Star)
                              </option>
                              <option value="Digital Downloads & Templates">
                                Digital Downloads, Software &amp; Templates
                              </option>
                            </select>
                          </label>
                        </div>

                        <h3 className="payment-heading">
                          3. Your Payout Account (Where Customers Pay You)
                        </h3>
                        <div className="checkout-field-grid">
                          <label>
                            Account Holder Title *
                            <input
                              required
                              value={sellerForm.accountTitle}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, accountTitle: e.target.value })
                              }
                              placeholder="Account title on Easypaisa / JazzCash / Bank"
                            />
                          </label>
                          <label>
                            Easypaisa Number (optional)
                            <input
                              value={sellerForm.easypaisa}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, easypaisa: e.target.value })
                              }
                              placeholder="03XX XXXXXXX"
                            />
                          </label>
                          <label>
                            JazzCash Number (optional)
                            <input
                              value={sellerForm.jazzcash}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, jazzcash: e.target.value })
                              }
                              placeholder="03XX XXXXXXX"
                            />
                          </label>
                          <label>
                            Bank Name &amp; IBAN / Account # (optional)
                            <input
                              value={sellerForm.bankAccount}
                              onChange={(e) =>
                                setSellerForm({ ...sellerForm, bankAccount: e.target.value })
                              }
                              placeholder="e.g. Meezan Bank - PK00MEZN..."
                            />
                          </label>
                        </div>

                        {sellerForm.plan === "lifetime_direct" && (
                          <div className="online-payment-box" style={{ marginTop: 16 }}>
                            <b>One-Time Lifetime Fee Payment ({money(lifetimeFeeSetting)})</b>
                            <p>
                              Transfer the one-time lifetime membership fee of{" "}
                              <strong>{money(lifetimeFeeSetting)}</strong> to the marketplace owner account and enter your transaction reference below.
                            </p>
                            <label>
                              Fee Transaction / Reference ID (TID) *
                              <input
                                required
                                value={sellerForm.paymentReference}
                                onChange={(e) =>
                                  setSellerForm({
                                    ...sellerForm,
                                    paymentReference: e.target.value,
                                  })
                                }
                                placeholder="Enter Easypaisa / JazzCash / Bank TID"
                              />
                            </label>
                          </div>
                        )}

                        {sellerError && <div className="checkout-error">{sellerError}</div>}

                        <button
                          type="submit"
                          className="checkout-submit"
                          disabled={sellerSubmitting}
                        >
                          {sellerSubmitting
                            ? "Sending to Admin Panel…"
                            : sellerApplication
                              ? "Update My Seller Application"
                              : sellerForm.plan === "trial_30_days"
                                ? "Submit for 1-Month Free Seller Trial"
                                : `Submit Lifetime Seller Application (${money(lifetimeFeeSetting)})`}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Rich Customer & Seller Footer */}
      <footer className="footer">
        <div className="footer-grid">
          <div>
            <a
              href="#top"
              className="footer-brand-white"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("home");
              }}
            >
              <span className="brand-flag-mark" aria-hidden="true">
                ☪
              </span>
              MEGAZONE
            </a>
            <p className="footer-meta">
              Pakistan’s white-and-green marketplace connecting shoppers with verified local sellers across electronics, fashion, gaming top-ups, and digital assets.
            </p>
          </div>

          <div className="footer-col">
            <h4>Marketplace Tabs</h4>
            <ul>
              <li>
                <button type="button" onClick={() => setActiveTab("home")}>
                  Home Storefront
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActiveTab("categories")}>
                  All Categories Directory
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActiveTab("orders")}>
                  My Orders &amp; Live Order Tracker
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setProfileSection("account");
                    setActiveTab("profile");
                  }}
                >
                  User Profile &amp; Settings
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Seller Center (In Profile Settings)</h4>
            <ul>
              <li>
                <button type="button" onClick={() => openProfileSection("seller")}>
                  Become a Seller (Apply in Profile)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openProfileSection("seller")}>
                  1-Month Free Seller Trial
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openProfileSection("seller")}>
                  One-Time Lifetime Membership
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openProfileSection("seller")}>
                  Check Seller Approval Status
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Popular Departments</h4>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory("Electronics");
                    setActiveTab("categories");
                  }}
                >
                  Electronics &amp; Gadgets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory("PUBG Mobile UC");
                    setActiveTab("categories");
                  }}
                >
                  PUBG Mobile UC Top-Up
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory("Free Fire Diamonds");
                    setActiveTab("categories");
                  }}
                >
                  Free Fire Diamonds
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory("Digital Products");
                    setTypeFilter("digital");
                    setActiveTab("categories");
                  }}
                >
                  Digital Downloads
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 MEGAZONE Pakistan. Proudly Made for Pakistan.</span>
          <span>Cash on Delivery · Easypaisa · JazzCash · Bank Transfer</span>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Navigation Bar (Daraz App Style: Home, Categories, My Orders, User Profile) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "home" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Home size={19} />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("categories");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <LayoutGrid size={19} />
          <span>Categories</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("orders");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <ClipboardList size={19} />
          <span>My Orders{allMyOrders.length > 0 ? ` (${allMyOrders.length})` : ""}</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("profile");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <UserRound size={19} />
          <span>Profile</span>
        </button>
      </nav>

      {/* Quick-View Product Detail Modal */}
      {quickViewProduct && (
        <div className="modal-backdrop" onClick={() => setQuickViewProduct(null)}>
          <section className="modal-sheet pdp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pdp-grid">
              <div className="pdp-media">
                {quickViewProduct.images?.[0] ? (
                  <img
                    src={quickViewProduct.images[0]}
                    alt={quickViewProduct.title}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={`product-fallback-art ${quickViewProduct.gameTopUp ? "game-art" : ""}`}
                  >
                    {quickViewProduct.gameTopUp ? (
                      <Gamepad2 size={48} />
                    ) : quickViewProduct.type === "digital" ? (
                      <Download size={48} />
                    ) : (
                      <Package size={48} />
                    )}
                    <span>{quickViewProduct.category}</span>
                  </div>
                )}
              </div>
              <div className="pdp-content">
                <div className="pdp-header">
                  <div className="product-meta">
                    <span className="product-meta-seller">{quickViewProduct.sellerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{quickViewProduct.category}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-close-btn"
                    onClick={() => setQuickViewProduct(null)}
                    aria-label="Close product details"
                  >
                    <X size={18} />
                  </button>
                </div>

                <h2 className="pdp-title">{quickViewProduct.title}</h2>
                <div className="pdp-price">
                  {money(quickViewProduct.price)}
                  {quickViewProduct.compareAtPrice &&
                    quickViewProduct.compareAtPrice > quickViewProduct.price && (
                      <del className="product-compare">{money(quickViewProduct.compareAtPrice)}</del>
                    )}
                </div>

                <p className="pdp-desc">
                  {quickViewProduct.description ||
                    "Authentic product fulfilled directly by verified MEGAZONE seller."}
                </p>

                <div className="pdp-specs">
                  <div>
                    <span>Delivery Type</span>
                    <strong>
                      {quickViewProduct.gameTopUp
                        ? "Instant Player ID Top-Up"
                        : quickViewProduct.type === "digital"
                          ? "Digital Download"
                          : "Nationwide Courier Delivery"}
                    </strong>
                  </div>
                  {quickViewProduct.gameTopUp && (
                    <div>
                      <span>Game / Package</span>
                      <strong>
                        {quickViewProduct.gameName || "Game"} ·{" "}
                        {quickViewProduct.gamePackage || "Top-Up"}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>Payment Methods</span>
                    <strong>
                      {quickViewProduct.type === "digital"
                        ? "Easypaisa / JazzCash / Bank Transfer"
                        : "Cash on Delivery (COD) or Online Transfer"}
                    </strong>
                  </div>
                </div>

                <div className="product-actions" style={{ marginTop: "auto" }}>
                  <button
                    type="button"
                    className="btn-cart"
                    onClick={() => {
                      add(quickViewProduct);
                      setQuickViewProduct(null);
                    }}
                  >
                    <ShoppingBag size={15} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    className="btn-buy-now"
                    onClick={() => buyNow(quickViewProduct)}
                  >
                    Buy Now <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}>
          <section className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="checkout-header">
              <div>
                <h2>{orderSuccess ? "Order Confirmed" : "Secure Checkout"}</h2>
                <p>
                  {orderSuccess
                    ? "Keep your order number below for live tracking."
                    : "Fill in your delivery or game account details to place your order."}
                </p>
              </div>
              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
              >
                <X size={18} />
              </button>
            </header>

            {orderSuccess ? (
              <div className="order-success">
                <div className="success-check">✓</div>
                <h3>Thank you for shopping with MEGAZONE!</h3>
                <p>{orderSuccess}</p>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: 18,
                  }}
                >
                  <button
                    type="button"
                    className="btn-cart"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setOrderSuccess("");
                      setActiveTab("orders");
                    }}
                  >
                    <ClipboardList size={15} /> Track in My Orders
                  </button>
                  <button
                    type="button"
                    className="btn-green-solid"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setOrderSuccess("");
                    }}
                  >
                    Continue Shopping <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={placeOrder} className="checkout-form">
                <div className="checkout-columns">
                  <div className="checkout-fields">
                    <h3>
                      {hasGameTopUp
                        ? hasPhysical
                          ? "Customer, Game & Delivery Details"
                          : "Customer & Game Account Details"
                        : "Delivery Information"}
                    </h3>

                    {hasGameTopUp && (
                      <div className="checkout-field-grid game-fields">
                        <label>
                          Game Player ID / UID *
                          <input
                            required
                            value={checkoutForm.playerId}
                            onChange={(e) =>
                              setCheckoutForm({ ...checkoutForm, playerId: e.target.value })
                            }
                            placeholder="Enter exact PUBG / Free Fire / Ludo UID"
                          />
                        </label>
                        <label>
                          In-Game Name (optional)
                          <input
                            value={checkoutForm.gameUsername}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                gameUsername: e.target.value,
                              })
                            }
                            placeholder="Your character name for verification"
                          />
                        </label>
                        <label className="field-full">
                          Server / Zone ID (optional)
                          <input
                            value={checkoutForm.serverId}
                            onChange={(e) =>
                              setCheckoutForm({ ...checkoutForm, serverId: e.target.value })
                            }
                            placeholder="Only if required by your game"
                          />
                        </label>
                        <p className="field-full game-warning">
                          Please double-check your Player ID. Top-ups are credited directly to this ID once payment is verified.
                        </p>
                      </div>
                    )}

                    <div className="checkout-field-grid">
                      <label>
                        Full Name *
                        <input
                          required
                          value={checkoutForm.name}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, name: e.target.value })
                          }
                          placeholder="Your full name"
                        />
                      </label>
                      <label>
                        Phone / WhatsApp Number *
                        <input
                          required
                          type="tel"
                          value={checkoutForm.phone}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, phone: e.target.value })
                          }
                          placeholder="03XX XXXXXXX"
                        />
                      </label>
                      <label className={hasPhysical ? "" : "field-full"}>
                        Email Address {hasDigital ? "*" : "(optional)"}
                        <input
                          required={hasDigital}
                          type="email"
                          value={checkoutForm.email}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, email: e.target.value })
                          }
                          placeholder="For order receipt & digital delivery"
                        />
                      </label>
                      {hasPhysical && (
                        <>
                          <label>
                            City *
                            <input
                              required
                              value={checkoutForm.city}
                              onChange={(e) =>
                                setCheckoutForm({ ...checkoutForm, city: e.target.value })
                              }
                              placeholder="Karachi, Lahore, Islamabad..."
                            />
                          </label>
                          <label className="field-full">
                            Complete Street Address *
                            <textarea
                              required
                              rows={2}
                              value={checkoutForm.address}
                              onChange={(e) =>
                                setCheckoutForm({
                                  ...checkoutForm,
                                  address: e.target.value,
                                })
                              }
                              placeholder="House/Flat #, Street, Area / Sector, Nearest Landmark"
                            />
                          </label>
                        </>
                      )}
                      <label className="field-full">
                        Order Notes (optional)
                        <textarea
                          rows={2}
                          value={checkoutForm.notes}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, notes: e.target.value })
                          }
                          placeholder="Delivery instructions or timing preference"
                        />
                      </label>
                    </div>

                    <h3 className="payment-heading">Select Payment Method</h3>

                    <label
                      className={`payment-option ${checkoutForm.payment === "cod" ? "selected" : ""} ${hasDigital ? "disabled-option" : ""}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        disabled={hasDigital}
                        checked={checkoutForm.payment === "cod"}
                        onChange={() =>
                          setCheckoutForm({
                            ...checkoutForm,
                            payment: "cod",
                            paymentReference: "",
                          })
                        }
                      />
                      <span className="payment-option-text">
                        <b>Cash on Delivery (COD)</b>
                        <small>
                          {hasDigital
                            ? "Available for physical courier items only"
                            : "Pay cash at your doorstep when your parcel arrives"}
                        </small>
                      </span>
                      <span className="payment-radio" />
                    </label>

                    <label
                      className={`payment-option ${checkoutForm.payment === "online" ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={checkoutForm.payment === "online"}
                        onChange={() =>
                          setCheckoutForm({ ...checkoutForm, payment: "online" })
                        }
                      />
                      <span className="payment-option-text">
                        <b>Easypaisa / JazzCash / Bank Transfer</b>
                        <small>
                          Send payment to the seller account below and enter your Transaction ID
                        </small>
                      </span>
                      <span className="payment-radio" />
                    </label>

                    {checkoutForm.payment === "online" && (
                      <div className="online-payment-box">
                        <b>Seller Payment Account Details</b>
                        {paymentInstructions.length ? (
                          <>
                            <p>
                              Transfer the exact amount to the seller account below, then enter your transaction/reference number:
                            </p>
                            {paymentInstructions.map((info) => (
                              <div className="payment-account-card" key={info.sellerId}>
                                <b>
                                  {info.accountTitle || "Marketplace Seller"} —{" "}
                                  {money(info.sellerSubtotal || checkoutTotal)}
                                </b>
                                {info.easypaisa && <span>Easypaisa: {info.easypaisa}</span>}
                                {info.jazzcash && <span>JazzCash: {info.jazzcash}</span>}
                                {info.bankName && (
                                  <span>
                                    Bank: {info.bankName}{" "}
                                    {info.bankAccount ? `— ${info.bankAccount}` : ""}
                                  </span>
                                )}
                                {info.instructions && <small>{info.instructions}</small>}
                              </div>
                            ))}
                          </>
                        ) : (
                          <span className="payment-warning">
                            Transfer {money(checkoutTotal)} via Easypaisa, JazzCash, or Bank Transfer and enter your Transaction ID (TID) below for verification.
                          </span>
                        )}
                        <label>
                          Transaction / Reference ID (TID) *
                          <input
                            required
                            value={checkoutForm.paymentReference}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                paymentReference: e.target.value,
                              })
                            }
                            placeholder="Enter 11-digit TID / Bank Reference Number"
                          />
                        </label>
                      </div>
                    )}

                    {checkoutError && <div className="checkout-error">{checkoutError}</div>}
                  </div>

                  <aside className="checkout-summary">
                    <div className="summary-title">
                      <ShoppingBag size={18} />
                      <b>Order Summary</b>
                      <span>
                        {checkoutTotalCount} {checkoutTotalCount === 1 ? "item" : "items"}
                      </span>
                    </div>

                    <div className="summary-items">
                      {checkoutItems.map(({ product: item, quantity }) => (
                        <div className="summary-item" key={item.id}>
                          <div className="summary-product-name">
                            <b>{item.title}</b>
                            <small>
                              {item.sellerName} · {money(item.price)} each
                            </small>
                            <div className="summary-qty-controls">
                              <button
                                type="button"
                                className="summary-qty-btn"
                                onClick={() => updateCheckoutQty(item.id, -1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="tabular-nums">{quantity}</span>
                              <button
                                type="button"
                                className="summary-qty-btn"
                                onClick={() => updateCheckoutQty(item.id, 1)}
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="summary-qty-btn summary-qty-remove"
                                onClick={() => updateCheckoutQty(item.id, -quantity)}
                                aria-label="Remove item"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <b className="tabular-nums">{money(item.price * quantity)}</b>
                        </div>
                      ))}
                    </div>

                    <div className="summary-total">
                      <span>Total Amount</span>
                      <strong>{money(checkoutTotal)}</strong>
                    </div>

                    <div className="summary-safe">
                      <ShieldCheck size={18} />
                      <span>
                        Your order is recorded with a unique MEGAZONE tracking number and routed directly to the seller.
                      </span>
                    </div>

                    <button type="submit" className="checkout-submit" disabled={placingOrder}>
                      {placingOrder ? "Submitting Order…" : `Place Order · ${money(checkoutTotal)}`}{" "}
                      <ArrowRight size={16} />
                    </button>

                    <small className="terms-note">
                      By placing this order, you confirm that your delivery and payment details are accurate.
                    </small>
                  </aside>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
