import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShoppingBag,
  Heart,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  X,
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
  Watch,
  Footprints,
  FileText,
  ExternalLink,
  Copy,
} from "lucide-react";
import { categories as defaultCategories } from "../shared/src/data";
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
import fashionImg from "./assets/images/fashion_footwear_showcase_1791785542648.jpg";
import homeAppliancesImg from "./assets/images/home_appliances_showcase_1791785554234.jpg";

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
  adminEmail?: string;
  adminPassword?: string;
  city: string;
  categoryFocus: string;
  membershipPlan: "trial_30_days" | "lifetime_direct";
  trialEndsAt?: string;
  lifetimeFeeAmount?: number;
  paymentStatus?: string;
  acceptedTerms?: boolean;
  status: "pending" | "approved" | "active" | "rejected" | "suspended";
  adminNote?: string;
  approvedRole?: string;
  adminPanelUrl?: string;
}

type MainTab = "home" | "categories" | "cart" | "orders" | "profile";
type ProfileSection = "account" | "wishlist" | "seller";
type SortOption = "featured" | "price-asc" | "price-desc" | "rating";

const HERO_SLIDES = [
  {
    id: "electronics",
    kicker: "☪ PAKISTAN’S ONLINE SHOPPING DESTINATION · NATIONWIDE COD",
    title: "Authentic Electronics, Phones & Gadgets Across Pakistan",
    subtitle:
      "Shop verified stores with doorstep Cash on Delivery, transparent pricing, and real-time order tracking.",
    ctaText: "Shop Latest Deals",
    image: heroImg,
  },
  {
    id: "fashion",
    kicker: "PREMIUM FASHION · FOOTWEAR & WRISTWATCHES",
    title: "Signature Apparel, Leather Footwear & Classic Watches",
    subtitle:
      "Curated seasonal fashion, sneakers, and accessories delivered across Pakistan with Cash on Delivery.",
    ctaText: "Explore Featured Deals",
    image: fashionImg,
  },
  {
    id: "home",
    kicker: "HOME & KITCHEN ESSENTIALS · FAST DISPATCH",
    title: "Modern Appliances & Everyday Home Upgrades",
    subtitle:
      "Upgrade your kitchen and home with quality appliances and 7-day easy return protection.",
    ctaText: "Browse Deals",
    image: homeAppliancesImg,
  },
];

const DEPARTMENT_TILES = [
  { name: "Electronics", icon: Laptop, desc: "Audio, laptops & gadgets" },
  { name: "Phones & Accessories", icon: Smartphone, desc: "Chargers, covers & cables" },
  { name: "Fashion", icon: Shirt, desc: "Men, women & eastern wear" },
  { name: "Shoes", icon: Footprints, desc: "Sneakers, formal & casual" },
  { name: "Watches & Accessories", icon: Watch, desc: "Wristwatches & eyewear" },
  { name: "Home & Kitchen", icon: Home, desc: "Appliances & daily living" },
];

const ORDER_STEPS = [
  { key: "new", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Packing / Processing" },
  { key: "shipped", label: "On the Way" },
  { key: "completed", label: "Delivered" },
];

const LEGAL_POLICIES: Record<string, { title: string; points: string[] }> = {
  terms: {
    title: "Terms & Conditions of Use",
    points: [
      "Welcome to MEGAZONE Pakistan. By accessing or placing an order on this website, you agree to abide by our platform shopping terms.",
      "All product prices are listed in Pakistani Rupees (PKR). Customers must provide accurate name, active mobile/WhatsApp number, and complete street address for courier delivery.",
      "Orders placed via Cash on Delivery (COD) are confirmed via phone/SMS before dispatch. Refusal of confirmed COD parcels without valid reason may restrict future COD ordering.",
      "Multi-vendor sellers registered on MEGAZONE are directly responsible for product authenticity, accurate descriptions, and timely dispatch.",
    ],
  },
  returns: {
    title: "7-Day Return, Refund & Exchange Policy",
    points: [
      "Customers are entitled to a 7-Day Easy Return & Check Warranty if the delivered item is damaged, defective, incomplete, or different from the description shown on the product page.",
      "To initiate a return or replacement, keep the original box, tags, and invoice intact and contact support with your Order ID (MZ-...).",
      "Once the returned parcel is inspected, your refund is processed via Easypaisa, JazzCash, or Bank Transfer within 3–5 working days.",
    ],
  },
  shipping: {
    title: "Shipping & Cash on Delivery (COD) Policy",
    points: [
      "MEGAZONE delivers nationwide across Pakistan (including Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, and all major cities/towns).",
      "Standard delivery time is 2 to 5 working days depending on your city and courier route.",
      "You can track your live order progress anytime in the 'My Orders' tab using your Order Number or Mobile Number.",
    ],
  },
  privacy: {
    title: "Privacy & Buyer Protection Policy",
    points: [
      "Your personal data (Name, Phone Number, Email, and Delivery Address) is strictly used to process, ship, and track your orders.",
      "MEGAZONE never sells or shares your personal contact details with unauthorized third parties.",
      "Online transfers (Easypaisa, JazzCash, or Bank Transfer) are verified against your Transaction Reference ID (TID) before order fulfillment.",
    ],
  },
};

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
  onOpenProduct,
  isWishlisted,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  onBuy: (p: Product) => void;
  onWishlist: (p: Product) => void;
  onOpenProduct: (p: Product) => void;
  isWishlisted: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasValidImg = Boolean(product.images?.[0]) && !imgFailed;

  const discountPercent =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  return (
    <article className="product-card">
      <div className="product-media" onClick={() => onOpenProduct(product)}>
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
        ) : (
          <div className="product-fallback-art">
            <Package size={36} />
            <span>{product.category || "Product"}</span>
          </div>
        )}
      </div>

      <div className="product-body">
        <div className="product-meta">
          <span className="product-meta-seller">{product.sellerName || "Verified Store"}</span>
          {product.category && (
            <>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
            </>
          )}
        </div>

        <h3 className="product-title" onClick={() => onOpenProduct(product)}>
          {product.title}
        </h3>

        {product.description && (
          <p className="product-desc-preview" onClick={() => onOpenProduct(product)}>
            {product.description}
          </p>
        )}

        <div className="product-rating-line">
          <span className="stars-gold">
            ★ {product.rating ? product.rating.toFixed(1) : "4.8"}
          </span>
          <span>·</span>
          <span>
            {product.reviewCount
              ? `${product.reviewCount} verified ratings`
              : "Authentic Quality"}
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
            <ShoppingBag size={14} /> Add to Cart
          </button>
          <button type="button" className="btn-buy-now" onClick={() => onBuy(product)}>
            Buy Now <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const catalogSectionRef = useRef<HTMLElement | null>(null);

  // 5 Main Tabs: Home, Categories, Cart, My Orders, Profile
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [profileSection, setProfileSection] = useState<ProfileSection>("account");

  // Full Daraz / Amazon-Style Product Detail Page (PDP) state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [pdpQuantity, setPdpQuantity] = useState(1);

  // Policy Modal state (for Terms & Conditions in Home Footer)
  const [activePolicyKey, setActivePolicyKey] = useState<string | null>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(configured);
  const [selectedCategoryInTab, setSelectedCategoryInTab] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [cart, setCart] = useState<CheckoutLine[]>([]);
  const [toast, setToast] = useState("");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Auth, User Profile & Multi-Vendor Admin Role state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("customer");
  const [userSellerStatus, setUserSellerStatus] = useState<string>("");
  const [userAdminPanelUrl, setUserAdminPanelUrl] = useState<string>("");
  const [globalAdminPanelUrl, setGlobalAdminPanelUrl] = useState<string>("");
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
  const [superAdminPaymentAccount, setSuperAdminPaymentAccount] = useState<{
    accountTitle: string;
    accountNumber: string;
    easypaisa: string;
    jazzcash: string;
    bankName: string;
    bankAccount: string;
    instructions: string;
  }>({
    accountTitle: "MEGAZONE Pakistan (Super Admin)",
    accountNumber: "",
    easypaisa: "",
    jazzcash: "",
    bankName: "",
    bankAccount: "",
    instructions:
      "Send the Lifetime Seller Membership fee to the official Super Admin account above and enter your TRX / Reference ID below for verification.",
  });

  // Become a Seller Form state (Inside User Profile Settings — Sends Gmail & Password to Super Admin Panel)
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
    categoryFocus: "Electronics, Fashion & General Merchandise",
    accountTitle: "",
    easypaisa: "",
    jazzcash: "",
    bankName: "",
    bankAccount: "",
    paymentReference: "",
    acceptedTerms: false,
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
  });

  const showToast = (msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), ms);
  };

  const openProductDetail = (p: Product) => {
    setSelectedProduct(p);
    setSelectedImageIdx(0);
    setPdpQuantity(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const switchMainTab = (tab: MainTab) => {
    setSelectedProduct(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToCatalog = () => {
    setSelectedProduct(null);
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
    setSelectedProduct(null);
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
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("megazone_wishlist", JSON.stringify(wishlistIds));
    } catch {}
  }, [wishlistIds]);

  // Listen to Firebase Auth state & live User Document + Seller Application status from Super Admin Panel
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
        setUserAdminPanelUrl("");
        return;
      }

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
            if (data.adminPanelUrl || data.panelUrl || data.sellerPanelUrl) {
              setUserAdminPanelUrl(data.adminPanelUrl || data.panelUrl || data.sellerPanelUrl);
            }

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
          () => {},
        );

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
          () => {},
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
      () => {},
    );
    return () => unsub();
  }, [currentUser]);

  // Load dynamic lifetime seller fee, Super Admin payment account numbers, and optional adminPanelUrl from settings/marketplacePayment
  useEffect(() => {
    if (!configured || !db) return;
    const unsub = onSnapshot(
      doc(db, "settings", "marketplacePayment"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const dynamicFee =
            typeof d?.lifetimeMembershipFee === "number"
              ? d.lifetimeMembershipFee
              : typeof d?.lifetimeFee === "number"
                ? d.lifetimeFee
                : typeof d?.sellerLifetimeFee === "number"
                  ? d.sellerLifetimeFee
                  : typeof d?.feeAmount === "number"
                    ? d.feeAmount
                    : Number(d?.lifetimeMembershipFee || d?.lifetimeFee || 0);
          if (dynamicFee > 0) {
            setLifetimeFeeSetting(dynamicFee);
          }
          setSuperAdminPaymentAccount({
            accountTitle:
              d?.accountTitle ||
              d?.superAdminAccountTitle ||
              d?.ownerName ||
              "MEGAZONE Pakistan (Super Admin)",
            accountNumber:
              d?.accountNumber ||
              d?.superAdminAccountNumber ||
              d?.primaryAccountNumber ||
              "",
            easypaisa: d?.easypaisa || d?.easypaisaNumber || "",
            jazzcash: d?.jazzcash || d?.jazzcashNumber || "",
            bankName: d?.bankName || "",
            bankAccount: d?.bankAccount || d?.iban || "",
            instructions:
              d?.instructions ||
              d?.sellerFeeInstructions ||
              "Send the Lifetime Seller Membership fee to the Super Admin account above and enter your TRX ID below.",
          });
          if (d?.adminPanelUrl || d?.sellerPanelUrl) {
            setGlobalAdminPanelUrl(d.adminPanelUrl || d.sellerPanelUrl);
          }
        }
      },
      () => {},
    );
    return () => unsub();
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
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        setCatalog(items);
        setLoadingCatalog(false);
      },
      () => {
        setLoadingCatalog(false);
      },
    );
    return () => unsub();
  }, []);

  // Available categories for the dedicated Categories Tab
  const availableCategories = useMemo(() => {
    const set = new Set<string>(defaultCategories);
    for (const p of catalog) {
      if (p.category && p.category.trim()) {
        const cat = p.category.trim();
        const lower = cat.toLowerCase();
        if (
          !lower.includes("digital") &&
          !lower.includes("pubg") &&
          !lower.includes("free fire") &&
          !lower.includes("ludo")
        ) {
          set.add(cat);
        }
      }
    }
    return Array.from(set);
  }, [catalog]);

  const allMyOrders = useMemo(() => {
    const map = new Map<string, OrderRecord>();
    for (const o of userOrders) map.set(o.orderNumber, o);
    for (const o of localOrders) {
      if (!map.has(o.orderNumber)) map.set(o.orderNumber, o);
    }
    return Array.from(map.values());
  }, [userOrders, localOrders]);

  // Determine if the user has been approved as Seller / Vendor Admin by the Super Admin Panel
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

  // Resolve the separate Admin Panel URL provided by Super Admin
  const resolvedAdminPanelUrl = useMemo(() => {
    const envUrl = ((import.meta as any).env?.VITE_ADMIN_PANEL_URL || "").trim();
    return (
      sellerApplication?.adminPanelUrl ||
      userAdminPanelUrl ||
      globalAdminPanelUrl ||
      envUrl ||
      ""
    );
  }, [sellerApplication, userAdminPanelUrl, globalAdminPanelUrl]);

  // Home Catalog Products (No Category filter on Home; filtered only by search query + sort)
  const homeVisibleProducts = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const filtered = catalog.filter(
      (p) =>
        !qLower ||
        `${p.title ?? ""} ${p.category ?? ""} ${p.sellerName ?? ""} ${p.description ?? ""} ${p.brand ?? ""}`
          .toLowerCase()
          .includes(qLower),
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
  }, [catalog, searchQuery, sortBy]);

  // Categories Tab Filtered Products
  const categoryTabProducts = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const filtered = catalog.filter(
      (p) =>
        (selectedCategoryInTab === "All" || p.category === selectedCategoryInTab) &&
        (!qLower ||
          `${p.title ?? ""} ${p.category ?? ""} ${p.sellerName ?? ""} ${p.description ?? ""} ${p.brand ?? ""}`
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
  }, [catalog, searchQuery, selectedCategoryInTab, sortBy]);

  const wishlistedProducts = useMemo(
    () => catalog.filter((p) => wishlistIds.includes(p.id)),
    [catalog, wishlistIds],
  );

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return catalog
      .filter((p) => p.id !== selectedProduct.id && p.category === selectedProduct.category)
      .slice(0, 3);
  }, [catalog, selectedProduct]);

  const totalCartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartTotalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );

  const add = (p: Product, qty = 1) => {
    setCart((old) => {
      const idx = old.findIndex((line) => line.product.id === p.id);
      if (idx >= 0) {
        return old.map((line, i) =>
          i === idx ? { ...line, quantity: Math.min(10, line.quantity + qty) } : line,
        );
      }
      return [...old, { product: p, quantity: Math.min(10, qty) }];
    });
    showToast(`${p.title} added to Cart`);
  };

  const updateCartTabQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.min(10, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const toggleWishlist = (p: Product) => {
    setWishlistIds((old) => {
      const exists = old.includes(p.id);
      const next = exists ? old.filter((id) => id !== p.id) : [...old, p.id];
      showToast(exists ? "Removed from wishlist" : "Saved to wishlist", 2200);
      return next;
    });
  };

  const buyNow = (p: Product, qty = 1) => {
    setCheckoutFromCart(false);
    setCheckoutItems([{ product: p, quantity: Math.min(10, qty) }]);
    setCheckoutForm((f) => ({
      ...f,
      payment: "cod",
      paymentReference: "",
    }));
    setCheckoutError("");
    setOrderSuccess("");
    setCheckoutOpen(true);
  };

  const openCartCheckout = () => {
    if (!cart.length) {
      showToast("Your cart is empty", 2200);
      return;
    }
    setCheckoutFromCart(true);
    setCheckoutItems(cart);
    setCheckoutForm((f) => ({
      ...f,
      payment: "cod",
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

  // Handle Customer Login / Sign Up / Password Reset
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
        } catch {}
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
          } catch {}
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
      } catch {}
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
      } catch {}
      setTrackingBusy(false);
    }

    setTrackingError(
      `No order found matching "${qRaw}". Please check your Order ID (e.g. MZ-...) or sign in with the account used to place the order.`,
    );
  };

  // Handle Multi-Vendor Become a Seller Submission (Sends Gmail, Password & Terms Agreement to Super Admin Panel)
  const handleSellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError("");
    setSellerSuccess("");

    const submitEmail = (sellerForm.email.trim() || currentUser?.email || "").trim();
    if (!sellerForm.shopName.trim() || !sellerForm.ownerName.trim() || !sellerForm.phone.trim()) {
      setSellerError("Please enter your Shop Name, Owner Full Name, and Mobile/WhatsApp Number.");
      return;
    }
    if (!submitEmail) {
      setSellerError("Please enter your Gmail / Email Address for your Seller Admin Panel login.");
      return;
    }
    if (sellerForm.password.trim().length < 6) {
      setSellerError(
        "Please enter a Password (minimum 6 characters) that you will use to log in to the Seller Admin Panel once approved.",
      );
      return;
    }
    if (!sellerForm.acceptedTerms) {
      setSellerError("Please read and accept the MEGAZONE Multi-Vendor Seller Terms & Conditions.");
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

      if (
        configured &&
        auth &&
        !currentUser &&
        submitEmail &&
        sellerForm.password.length >= 6
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            submitEmail,
            sellerForm.password,
          );
          await updateProfile(cred.user, { displayName: sellerForm.ownerName.trim() });
          sellerUid = cred.user.uid;
        } catch (authErr: any) {
          const code = String(authErr?.code || "");
          if (code.includes("email-already-in-use")) {
            try {
              const cred = await signInWithEmailAndPassword(
                auth,
                submitEmail,
                sellerForm.password,
              );
              sellerUid = cred.user.uid;
            } catch {
              // Proceed with submitting application to Firestore for Super Admin even if Auth password differs
            }
          }
        }
      }

      const applicationPayload: SellerApplicationDoc = {
        uid: sellerUid,
        shopName: sellerForm.shopName.trim(),
        ownerName: sellerForm.ownerName.trim(),
        phone: sellerForm.phone.trim(),
        email: submitEmail,
        adminEmail: submitEmail,
        adminPassword: sellerForm.password,
        city: sellerForm.city.trim(),
        categoryFocus: sellerForm.categoryFocus,
        membershipPlan: sellerForm.plan,
        trialEndsAt: trialEnds.toISOString(),
        lifetimeFeeAmount: lifetimeFeeSetting,
        paymentStatus:
          sellerForm.plan === "trial_30_days" ? "free_trial_active" : "pending_verification",
        acceptedTerms: true,
        status: "pending",
      };

      if (configured && db) {
        try {
          await setDoc(
            doc(db, "sellerApplications", sellerUid),
            {
              ...applicationPayload,
              storeName: sellerForm.shopName.trim(),
              name: sellerForm.ownerName.trim(),
              password: sellerForm.password,
              membershipType: "lifetime",
              freeTrialDays: 30,
              trialStartsAt: now.toISOString(),
              currency: "PKR",
              paymentReference: sellerForm.paymentReference.trim(),
              trxId: sellerForm.paymentReference.trim(),
              transactionId: sellerForm.paymentReference.trim(),
              lifetimeFeeAmount: lifetimeFeeSetting,
              superAdminAccountUsed:
                superAdminPaymentAccount.accountNumber ||
                superAdminPaymentAccount.easypaisa ||
                superAdminPaymentAccount.jazzcash ||
                superAdminPaymentAccount.bankAccount ||
                "Super Admin Account",
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
          try {
            const fallbackRef = doc(collection(db, "sellerApplications"));
            await setDoc(fallbackRef, {
              ...applicationPayload,
              storeName: sellerForm.shopName.trim(),
              name: sellerForm.ownerName.trim(),
              password: sellerForm.password,
              accountTitle: sellerForm.accountTitle.trim() || sellerForm.ownerName.trim(),
              easypaisa: sellerForm.easypaisa.trim(),
              jazzcash: sellerForm.jazzcash.trim(),
              bankAccount: sellerForm.bankAccount.trim(),
              paymentReference: sellerForm.paymentReference.trim(),
              trxId: sellerForm.paymentReference.trim(),
              transactionId: sellerForm.paymentReference.trim(),
              lifetimeFeeAmount: lifetimeFeeSetting,
              createdAt: serverTimestamp(),
            });
          } catch {}
        }

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

        try {
          await setDoc(
            doc(db, "users", sellerUid),
            {
              uid: sellerUid,
              displayName: sellerForm.ownerName.trim(),
              email: submitEmail,
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
        `Your Multi-Vendor Seller Application for “${sellerForm.shopName.trim()}” (Login Gmail: ${submitEmail}) has been sent to the Super Admin Panel! Once the Super Admin adds your credentials and approves your status, you will receive your approval notification and Seller Admin Panel URL right here in your Profile.`,
      );
      showToast("Seller application sent to Super Admin!");
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
    if (checkoutForm.city.trim().length < 2 || checkoutForm.address.trim().length < 8) {
      setCheckoutError("Please enter your city and complete delivery address.");
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
      type: "physical",
      sellerId: p.sellerId,
      sellerName: String(p.sellerName ?? "Marketplace seller").slice(0, 100),
      gameTopUp: false,
      gameName: "",
      gamePackage: "",
    }));

    const orderPayload = {
      orderNumber: fallbackOrderNumber,
      customerName: checkoutForm.name.trim(),
      phone: checkoutForm.phone.trim(),
      email: checkoutForm.email.trim(),
      city: checkoutForm.city.trim(),
      address: checkoutForm.address.trim(),
      notes: checkoutForm.notes.trim(),
      playerId: "",
      serverId: "",
      gameUsername: "",
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
        playerId: "",
        serverId: "",
        gameUsername: "",
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
            playerId: "",
            serverId: "",
            gameUsername: "",
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
  const activePolicy = activePolicyKey ? LEGAL_POLICIES[activePolicyKey] : null;

  return (
    <div className="app-shell">
      {/* Top Pakistani Flag Green Strip (Scrolls naturally with page) */}
      <div className="promo-strip">
        <div className="promo-strip-inner">
          <span>
            ☪ MEGAZONE Pakistan · Official Multi-Vendor Online Shopping Marketplace
          </span>
          <div className="promo-links">
            <button type="button" onClick={() => switchMainTab("orders")}>
              Track Order {allMyOrders.length > 0 ? `(${allMyOrders.length})` : ""}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setProfileSection("account");
                switchMainTab("profile");
              }}
            >
              {currentUser
                ? `Hi, ${authForm.name || currentUser.displayName || currentUser.email?.split("@")[0]}`
                : "Sign In / Sign Up"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Header (Scrolls naturally on scroll — NO Cart button stuck next to MEGAZONE name) */}
      <header className="topbar">
        <div className="topbar-inner">
          <a
            href="#top"
            className="brand-wordmark"
            onClick={(e) => {
              e.preventDefault();
              setSelectedProduct(null);
              setActiveTab("home");
              setSearchQuery("");
            }}
          >
            <span className="brand-flag-mark" aria-hidden="true">
              ☪
            </span>
            MEGA<span>ZONE</span>
            <small className="brand-tagline">Online Shopping in Pakistan</small>
          </a>

          {/* Styled 5-Tab Navigation Bar (Home, Categories, Cart, My Orders, Profile) */}
          <nav className="topbar-nav" aria-label="Main Marketplace Tabs">
            <button
              type="button"
              className={`topbar-link ${activeTab === "home" && !selectedProduct ? "active" : ""}`}
              onClick={() => switchMainTab("home")}
            >
              <Home size={15} />
              <span>Home</span>
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "categories" && !selectedProduct ? "active" : ""}`}
              onClick={() => switchMainTab("categories")}
            >
              <LayoutGrid size={15} />
              <span>Categories</span>
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "cart" && !selectedProduct ? "active" : ""}`}
              onClick={() => switchMainTab("cart")}
            >
              <ShoppingBag size={15} />
              <span>Cart</span>
              <span className="tab-count-text">({totalCartCount})</span>
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "orders" && !selectedProduct ? "active" : ""}`}
              onClick={() => switchMainTab("orders")}
            >
              <ClipboardList size={15} />
              <span>My Orders</span>
              {allMyOrders.length > 0 && (
                <span className="tab-count-text">({allMyOrders.length})</span>
              )}
            </button>
            <button
              type="button"
              className={`topbar-link ${activeTab === "profile" && !selectedProduct ? "active" : ""}`}
              onClick={() => switchMainTab("profile")}
            >
              <UserRound size={15} />
              <span>{currentUser ? "My Profile" : "Account / Login"}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Search Bar (Categories strip is NOT shown on Home; Categories are strictly in the Categories Tab) */}
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
                setSelectedProduct(null);
                if (activeTab !== "home" && activeTab !== "categories") {
                  setActiveTab("home");
                }
              }}
              placeholder="Search products on MEGAZONE Pakistan — e.g. Smart Watch, Earbuds, Sneakers, Kitchen Appliances..."
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
        </div>
      </div>

      {/* Live Super Admin Approval Notification Banner */}
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
              <strong>🎉 Seller Account Approved by Super Admin!</strong> Your store{" "}
              <strong>{sellerApplication?.shopName || "MEGAZONE Vendor Store"}</strong> is active. You can now access the Admin Panel with your registered Gmail &amp; Password.
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
              Open Seller Details &amp; URL
            </button>
          </div>
        </div>
      )}

      <main className="main-container" id="top">
        {/* =========================================================
            DARAZ / AMAZON-STYLE FULL PRODUCT DETAIL PAGE (When a product is clicked)
           ========================================================= */}
        {selectedProduct ? (
          <section className="pdp-full-page">
            <div className="pdp-breadcrumb-bar">
              <button
                type="button"
                className="pdp-back-btn"
                onClick={() => setSelectedProduct(null)}
              >
                <ArrowLeft size={16} /> Back to Products
              </button>
              <div className="pdp-breadcrumbs">
                <span>MEGAZONE Pakistan</span>
                <span aria-hidden="true">/</span>
                <span>{selectedProduct.category || "Store"}</span>
                <span aria-hidden="true">/</span>
                <strong style={{ color: "#01411c" }}>{selectedProduct.title}</strong>
              </div>
            </div>

            <div className="pdp-main-card">
              {/* Column 1: Multi-Image Gallery */}
              <div className="pdp-gallery-col">
                <div className="pdp-main-stage">
                  <button
                    type="button"
                    className={`wishlist-trigger ${wishlistIds.includes(selectedProduct.id) ? "active" : ""}`}
                    onClick={() => toggleWishlist(selectedProduct)}
                    aria-label="Save to wishlist"
                  >
                    <Heart
                      size={18}
                      fill={wishlistIds.includes(selectedProduct.id) ? "currentColor" : "none"}
                    />
                  </button>

                  {selectedProduct.images?.[selectedImageIdx] || selectedProduct.images?.[0] ? (
                    <img
                      src={selectedProduct.images[selectedImageIdx] || selectedProduct.images[0]}
                      alt={selectedProduct.title}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="product-fallback-art">
                      <Package size={56} />
                      <span>{selectedProduct.category}</span>
                    </div>
                  )}
                </div>

                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="pdp-thumb-row">
                    {selectedProduct.images.map((imgUrl, idx) => (
                      <button
                        type="button"
                        key={`${selectedProduct.id}-img-${idx}`}
                        className={`pdp-thumb-btn ${selectedImageIdx === idx ? "active" : ""}`}
                        onClick={() => setSelectedImageIdx(idx)}
                      >
                        <img
                          src={imgUrl}
                          alt={`${selectedProduct.title} thumbnail ${idx + 1}`}
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2: Title, Rating, Price, Short Description, Quantity & Add to Cart / Buy Now */}
              <div className="pdp-info-col">
                <div className="product-meta">
                  <span className="product-meta-seller">
                    Sold by: {selectedProduct.sellerName || "MEGAZONE Verified Store"}
                  </span>
                  {selectedProduct.brand && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Brand: {selectedProduct.brand}</span>
                    </>
                  )}
                </div>

                <h1 className="pdp-MainTitle">{selectedProduct.title}</h1>

                <div className="pdp-rating-strip">
                  <span className="stars-gold">
                    ★★★★★ {selectedProduct.rating ? selectedProduct.rating.toFixed(1) : "4.8"}
                  </span>
                  <span>·</span>
                  <span>
                    {selectedProduct.reviewCount
                      ? `${selectedProduct.reviewCount} Verified Customer Ratings`
                      : "Verified Quality Checked"}
                  </span>
                  <span>·</span>
                  <strong style={{ color: "#008751" }}>
                    {typeof selectedProduct.stock === "number" && selectedProduct.stock <= 0
                      ? "Out of Stock"
                      : "In Stock · Ready to Ship"}
                  </strong>
                </div>

                <div className="pdp-price-box">
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span className="pdp-big-price">{money(selectedProduct.price)}</span>
                    {selectedProduct.compareAtPrice &&
                      selectedProduct.compareAtPrice > selectedProduct.price && (
                        <>
                          <del className="product-compare" style={{ fontSize: 14 }}>
                            {money(selectedProduct.compareAtPrice)}
                          </del>
                          <span className="discount-text" style={{ fontSize: 13 }}>
                            Save{" "}
                            {Math.round(
                              ((selectedProduct.compareAtPrice - selectedProduct.price) /
                                selectedProduct.compareAtPrice) *
                                100,
                            )}
                            %
                          </span>
                        </>
                      )}
                  </div>
                  <small style={{ display: "block", marginTop: 4, color: "#3b5244", fontSize: 12 }}>
                    Inclusive of all taxes · Nationwide Cash on Delivery (COD) available
                  </small>
                </div>

                <p className="pdp-short-desc">
                  {selectedProduct.description ||
                    "Authentic quality product fulfilled by a verified seller on MEGAZONE Pakistan. Enjoy doorstep Cash on Delivery and complete peace of mind."}
                </p>

                <div className="pdp-qty-row">
                  <span className="pdp-qty-label">Quantity:</span>
                  <div className="pdp-qty-stepper">
                    <button
                      type="button"
                      onClick={() => setPdpQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span>{pdpQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setPdpQuantity((q) => Math.min(10, q + 1))}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pdp-cta-row">
                  <button
                    type="button"
                    className="btn-cart"
                    onClick={() => add(selectedProduct, pdpQuantity)}
                  >
                    <ShoppingBag size={17} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    className="btn-buy-now"
                    onClick={() => buyNow(selectedProduct, pdpQuantity)}
                  >
                    Buy Now <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              {/* Column 3: Delivery, Warranty & Seller Assurance Box */}
              <aside className="pdp-delivery-col">
                <h4>Delivery &amp; Service</h4>

                <div className="pdp-service-row">
                  <Truck size={18} color="#01411c" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Nationwide Home Delivery</strong>
                    <span>
                      {selectedProduct.deliveryTime ||
                        "Standard Courier Dispatch (2–5 Working Days across Pakistan)"}
                    </span>
                  </div>
                </div>

                <div className="pdp-service-row">
                  <BadgeCheck size={18} color="#01411c" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Cash on Delivery Available</strong>
                    <span>Pay cash at your doorstep when you receive your parcel</span>
                  </div>
                </div>

                <div className="pdp-service-row">
                  <RotateCcw size={18} color="#01411c" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Return &amp; Warranty Policy</strong>
                    <span>
                      {selectedProduct.returnPolicy ||
                        selectedProduct.warranty ||
                        "7-Day Easy Check & Return Guarantee for damaged or incorrect items"}
                    </span>
                  </div>
                </div>

                <div className="pdp-service-row">
                  <Store size={18} color="#01411c" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Sold by {selectedProduct.sellerName || "MEGAZONE Partner"}</strong>
                    <span>Verified Pakistani Multi-Vendor Store</span>
                  </div>
                </div>
              </aside>
            </div>

            {/* Full Product Description & Specifications Card (Set via Admin Panel) */}
            <div className="pdp-details-card">
              <h3>Product Description &amp; Details — {selectedProduct.title}</h3>
              <div className="pdp-full-description">
                {selectedProduct.description
                  ? selectedProduct.description
                  : `Experience reliable quality with ${selectedProduct.title}, brought to you by ${selectedProduct.sellerName || "our verified Pakistani store"} on MEGAZONE Pakistan.\n\n• Carefully inspected before dispatch for guaranteed customer satisfaction.\n• Nationwide courier delivery with Cash on Delivery (COD), Easypaisa, JazzCash, and Bank Transfer options.\n• Real-time order tracking included from confirmation to doorstep delivery.`}
              </div>

              {Array.isArray(selectedProduct.highlights) && selectedProduct.highlights.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 10px", color: "#01411c" }}>Key Highlights</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14 }}>
                    {selectedProduct.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <h3>Product Specifications</h3>
              <div className="pdp-specs-grid">
                <div className="pdp-spec-box">
                  <span>Category</span>
                  <strong>{selectedProduct.category || "General Merchandise"}</strong>
                </div>
                <div className="pdp-spec-box">
                  <span>Brand / Store</span>
                  <strong>{selectedProduct.brand || selectedProduct.sellerName || "MEGAZONE Verified"}</strong>
                </div>
                <div className="pdp-spec-box">
                  <span>Delivery Option</span>
                  <strong>Nationwide Cash on Delivery (COD)</strong>
                </div>
                <div className="pdp-spec-box">
                  <span>Payment Methods</span>
                  <strong>COD, Easypaisa, JazzCash &amp; Bank</strong>
                </div>
                {selectedProduct.sku && (
                  <div className="pdp-spec-box">
                    <span>SKU / Model</span>
                    <strong>{selectedProduct.sku}</strong>
                  </div>
                )}
                {selectedProduct.warranty && (
                  <div className="pdp-spec-box">
                    <span>Warranty</span>
                    <strong>{selectedProduct.warranty}</strong>
                  </div>
                )}
                {selectedProduct.specifications &&
                  !Array.isArray(selectedProduct.specifications) &&
                  Object.entries(selectedProduct.specifications).map(([k, v]) => (
                    <div className="pdp-spec-box" key={k}>
                      <span>{k}</span>
                      <strong>{String(v)}</strong>
                    </div>
                  ))}
                {Array.isArray(selectedProduct.specifications) &&
                  selectedProduct.specifications.map((row, idx) => (
                    <div className="pdp-spec-box" key={idx}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
              </div>
            </div>

            {relatedProducts.length > 0 && (
              <div>
                <div className="section-bar">
                  <div>
                    <h2>Similar Products</h2>
                    <p>More items you might also like</p>
                  </div>
                </div>
                <div className="product-grid">
                  {relatedProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAdd={(item) => add(item, 1)}
                      onBuy={(item) => buyNow(item, 1)}
                      onWishlist={toggleWishlist}
                      onOpenProduct={openProductDetail}
                      isWishlisted={wishlistIds.includes(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* =========================================================
                TAB 1: HOME (Direct Daraz-Style Product Feed — No COD / Hero Clutter)
               ========================================================= */}
            {activeTab === "home" && (
              <section className="catalog-section" ref={catalogSectionRef} style={{ marginTop: 4 }}>
                <div className="section-bar">
                  <div>
                    <h2>Just For You · All Products</h2>
                    <p>
                      {loadingCatalog
                        ? "Loading marketplace products…"
                        : `Showing ${homeVisibleProducts.length} ${
                            homeVisibleProducts.length === 1 ? "product" : "products"
                          }${searchQuery ? ` for “${searchQuery}”` : ""} — tap any product for full details`}
                    </p>
                  </div>

                  <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort products"
                  >
                    <option value="featured">Sort: Best Match</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>

                {loadingCatalog ? (
                  <div className="empty-catalog">
                    <h3>Loading products for you…</h3>
                    <p>Fetching live products from MEGAZONE Pakistan.</p>
                  </div>
                ) : homeVisibleProducts.length > 0 ? (
                  <div className="product-grid">
                    {homeVisibleProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onAdd={(item) => add(item, 1)}
                        onBuy={(item) => buyNow(item, 1)}
                        onWishlist={toggleWishlist}
                        onOpenProduct={openProductDetail}
                        isWishlisted={wishlistIds.includes(p.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-catalog">
                    <Search size={30} color="#01411c" />
                    <h3>
                      {searchQuery ? "No matching products found" : "No Products Published Yet"}
                    </h3>
                    <p>
                      {searchQuery
                        ? "Try clearing your search to explore all available products."
                        : "Products added by sellers and admins from the Admin Panel will appear directly right here like Daraz."}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        className="btn-green-solid"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* =========================================================
                TAB 2: DEDICATED CATEGORIES TAB (All Category Browsing Lives Here)
               ========================================================= */}
            {activeTab === "categories" && (
              <section className="tab-page-section">
                <div className="section-bar">
                  <div>
                    <h2>Shop by Category</h2>
                    <p>Select any department below to browse products in that category</p>
                  </div>
                  {selectedCategoryInTab !== "All" && (
                    <button
                      type="button"
                      className="btn-cart"
                      onClick={() => setSelectedCategoryInTab("All")}
                    >
                      Show All Categories
                    </button>
                  )}
                </div>

                <div className="dept-grid" style={{ marginBottom: 24 }}>
                  {DEPARTMENT_TILES.map((dept) => {
                    const Icon = dept.icon;
                    const isActive = selectedCategoryInTab === dept.name;
                    return (
                      <button
                        type="button"
                        key={dept.name}
                        className={`dept-card ${isActive ? "active" : ""}`}
                        onClick={() => setSelectedCategoryInTab(dept.name)}
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
                    {["All", ...availableCategories].map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={`segmented-btn ${selectedCategoryInTab === c ? "active" : ""}`}
                        onClick={() => setSelectedCategoryInTab(c)}
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

                {categoryTabProducts.length > 0 ? (
                  <div className="product-grid">
                    {categoryTabProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onAdd={(item) => add(item, 1)}
                        onBuy={(item) => buyNow(item, 1)}
                        onWishlist={toggleWishlist}
                        onOpenProduct={openProductDetail}
                        isWishlisted={wishlistIds.includes(p.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-catalog">
                    <LayoutGrid size={30} color="#01411c" />
                    <h3>No products in “{selectedCategoryInTab}” yet</h3>
                    <p>Products added to this category from the Admin Panel will appear here.</p>
                    <button
                      type="button"
                      className="btn-green-solid"
                      onClick={() => setSelectedCategoryInTab("All")}
                    >
                      View All Categories
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================
                TAB 3: DEDICATED SHOPPING CART TAB
               ========================================================= */}
            {activeTab === "cart" && (
              <section className="tab-page-section">
                <div className="section-bar">
                  <div>
                    <h2>My Shopping Cart ({totalCartCount})</h2>
                    <p>Review your selected items, adjust quantities, or proceed to Buy Now</p>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      className="btn-cart"
                      onClick={() => switchMainTab("home")}
                    >
                      + Add More Products
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="empty-catalog">
                    <ShoppingBag size={34} color="#01411c" />
                    <h3>Your MEGAZONE Cart is Empty</h3>
                    <p>
                      Browse our online store and tap “Add to Cart” or “Buy Now” on any product to start your order.
                    </p>
                    <button
                      type="button"
                      className="btn-green-solid"
                      onClick={() => switchMainTab("home")}
                    >
                      Explore Products <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="cart-layout">
                    <div className="cart-list-card">
                      {cart.map(({ product: item, quantity }) => (
                        <div className="cart-row" key={item.id}>
                          <div
                            className="cart-row-thumb"
                            onClick={() => openProductDetail(item)}
                          >
                            {item.images?.[0] ? (
                              <img
                                src={item.images[0]}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Package size={28} color="#01411c" />
                            )}
                          </div>

                          <div className="cart-row-info">
                            <h4 onClick={() => openProductDetail(item)}>{item.title}</h4>
                            <small>
                              Sold by {item.sellerName || "Verified Seller"} · {money(item.price)} each
                            </small>
                            <div className="summary-qty-controls">
                              <button
                                type="button"
                                className="summary-qty-btn"
                                onClick={() => updateCartTabQty(item.id, -1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span
                                className="tabular-nums"
                                style={{ fontWeight: 700, minWidth: 22, textAlign: "center" }}
                              >
                                {quantity}
                              </span>
                              <button
                                type="button"
                                className="summary-qty-btn"
                                onClick={() => updateCartTabQty(item.id, 1)}
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="summary-qty-btn summary-qty-remove"
                                onClick={() => updateCartTabQty(item.id, -quantity)}
                                aria-label="Remove item"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          <div className="cart-row-price">
                            {money(item.price * quantity)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <aside className="checkout-summary">
                      <div className="summary-title">
                        <ShoppingBag size={18} />
                        <b>Cart Summary</b>
                        <span>
                          {totalCartCount} {totalCartCount === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="summary-items">
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                          <span>Items Subtotal</span>
                          <strong className="tabular-nums">{money(cartTotalAmount)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                          <span>Payment Options</span>
                          <strong>COD / Easypaisa / JazzCash</strong>
                        </div>
                      </div>

                      <div className="summary-total">
                        <span>Total Payable</span>
                        <strong>{money(cartTotalAmount)}</strong>
                      </div>

                      <div className="summary-safe">
                        <ShieldCheck size={18} />
                        <span>
                          Every order comes with a live MEGAZONE tracking ID and 7-day easy return protection.
                        </span>
                      </div>

                      <button
                        type="button"
                        className="checkout-submit"
                        onClick={openCartCheckout}
                      >
                        Proceed to Buy Now ({money(cartTotalAmount)}) <ArrowRight size={16} />
                      </button>
                    </aside>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================
                TAB 4: MY ORDERS & LIVE ORDER TRACKING SYSTEM
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
                      Once you buy a product, live step-by-step order tracking will appear right here.
                    </p>
                    <button
                      type="button"
                      className="btn-green-solid"
                      onClick={() => switchMainTab("home")}
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
                TAB 5: RESPONSIVE USER PROFILE & MULTI-VENDOR SELLER HUB
               ========================================================= */}
            {activeTab === "profile" && (
              <section className="tab-page-section">
                <div className="profile-hub-wrapper">
                  {/* Top Identity Banner */}
                  <div className="profile-top-card">
                    <div className="profile-user-identity">
                      <div className="profile-avatar">
                        {(authForm.name || currentUser?.displayName || currentUser?.email || "M")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="profile-user-text">
                        <h3>
                          {currentUser
                            ? authForm.name || currentUser.displayName || "MEGAZONE Member"
                            : "Welcome to MEGAZONE Pakistan"}
                        </h3>
                        <p>
                          {currentUser
                            ? currentUser.email
                            : "Sign in or create an account to manage your profile, orders & seller settings"}
                        </p>
                        {isSellerApproved && (
                          <div
                            style={{
                              marginTop: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#9ef0c4",
                            }}
                          >
                            <CheckCircle2 size={14} /> Approved Multi-Vendor Seller / Admin
                          </div>
                        )}
                      </div>
                    </div>

                    {currentUser && (
                      <button
                        type="button"
                        className="btn-white-green"
                        style={{ height: 38, padding: "0 14px", fontSize: 12.5 }}
                        onClick={async () => {
                          if (auth) await signOut(auth);
                          showToast("Signed out of MEGAZONE");
                        }}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    )}
                  </div>

                  {/* Responsive 4-Card Section Switcher */}
                  <div className="profile-subnav-grid">
                    <button
                      type="button"
                      className={`profile-subnav-btn ${profileSection === "account" ? "active" : ""}`}
                      onClick={() => setProfileSection("account")}
                    >
                      <div className="profile-subnav-icon">
                        <UserRound size={17} />
                      </div>
                      <div>
                        <strong>{currentUser ? "Account Settings" : "Login / Sign Up"}</strong>
                        <small>Profile &amp; delivery address</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`profile-subnav-btn ${profileSection === "wishlist" ? "active" : ""}`}
                      onClick={() => setProfileSection("wishlist")}
                    >
                      <div className="profile-subnav-icon">
                        <Heart size={17} />
                      </div>
                      <div>
                        <strong>Wishlist ({wishlistIds.length})</strong>
                        <small>Saved items</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="profile-subnav-btn"
                      onClick={() => switchMainTab("orders")}
                    >
                      <div className="profile-subnav-icon">
                        <ClipboardList size={17} />
                      </div>
                      <div>
                        <strong>My Orders ({allMyOrders.length})</strong>
                        <small>Live order tracker</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`profile-subnav-btn ${profileSection === "seller" ? "active" : ""}`}
                      onClick={() => setProfileSection("seller")}
                    >
                      <div className="profile-subnav-icon">
                        <Store size={17} />
                      </div>
                      <div>
                        <strong>
                          {isSellerApproved
                            ? "Seller Approved ✓"
                            : sellerApplication?.status === "pending"
                              ? "Seller (Pending)"
                              : "Become a Seller"}
                        </strong>
                        <small>Apply for Vendor Admin</small>
                      </div>
                    </button>
                  </div>

                  {/* Profile Main Content Card */}
                  <div className="profile-content-card">
                    {/* Official Super Admin Approval Banner + Separate Admin Panel URL & Login Info */}
                    {isSellerApproved && (
                      <div className="seller-approved-banner">
                        <small style={{ fontWeight: 700, color: "#9ef0c4" }}>
                          ☪ OFFICIAL SUPER ADMIN APPROVAL NOTIFICATION
                        </small>
                        <h3>
                          Congratulations! Your Multi-Vendor Seller Account Is Approved
                        </h3>
                        <p>
                          Super Admin has approved your store{" "}
                          <strong>{sellerApplication?.shopName || "MEGAZONE Partner Store"}</strong>{" "}
                          and activated your{" "}
                          <strong>
                            {userRole === "super_admin" || userRole === "admin"
                              ? "Admin & Seller"
                              : "Vendor / Seller Admin"}
                          </strong>{" "}
                          account. Use the Gmail and Password you submitted in your application to log in to the separate Seller Admin Panel:
                        </p>

                        <div className="admin-access-box">
                          <div>
                            <small style={{ color: "#9ef0c4", fontWeight: 700, display: "block" }}>
                              APPROVED ADMIN LOGIN GMAIL:
                            </small>
                            <code>{sellerApplication?.email || currentUser?.email || "Your registered Gmail"}</code>
                          </div>

                          {resolvedAdminPanelUrl ? (
                            <div>
                              <small style={{ color: "#9ef0c4", fontWeight: 700, display: "block", marginBottom: 4 }}>
                                SELLER ADMIN PANEL URL (PROVIDED BY SUPER ADMIN):
                              </small>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <code>{resolvedAdminPanelUrl}</code>
                                <a
                                  href={resolvedAdminPanelUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-white-green"
                                  style={{ height: 34, padding: "0 12px", fontSize: 12 }}
                                >
                                  Open Admin Panel <ExternalLink size={13} />
                                </a>
                                <button
                                  type="button"
                                  className="btn-outline-light"
                                  style={{ height: 34, padding: "0 10px", fontSize: 12 }}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(resolvedAdminPanelUrl);
                                    showToast("Admin Panel URL copied!");
                                  }}
                                >
                                  <Copy size={13} /> Copy URL
                                </button>
                              </div>
                            </div>
                          ) : (
                            <small style={{ color: "rgba(255,255,255,0.85)" }}>
                              Your Seller Admin Panel URL will appear here automatically as soon as Super Admin attaches the panel link in your approval record.
                            </small>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-VIEW A: Account Sign In / Sign Up / Delivery Profile */}
                    {profileSection === "account" && (
                      <>
                        {!currentUser ? (
                          <form onSubmit={handleAuthSubmit}>
                            <div className="section-bar" style={{ marginBottom: 14 }}>
                              <div>
                                <h2>
                                  {authMode === "login"
                                    ? "Sign In to MEGAZONE Pakistan"
                                    : authMode === "signup"
                                      ? "Create Your MEGAZONE Account"
                                      : "Reset Your Password"}
                                </h2>
                                <p>
                                  Access your saved delivery address, order tracking, and Seller application settings.
                                </p>
                              </div>
                            </div>

                            <div className="segmented-group" style={{ marginBottom: 18 }}>
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
                                  placeholder="you@gmail.com"
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
                            <div className="section-bar" style={{ marginBottom: 16 }}>
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
                              onClick={() => switchMainTab("home")}
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
                                onAdd={(item) => add(item, 1)}
                                onBuy={(item) => buyNow(item, 1)}
                                onWishlist={toggleWishlist}
                                onOpenProduct={openProductDetail}
                                isWishlisted={true}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-VIEW C: Multi-Vendor Become a Seller Application (With Terms, Gmail & Password for Super Admin) */}
                    {profileSection === "seller" && (
                      <div>
                        <div className="section-bar" style={{ marginBottom: 16 }}>
                          <div>
                            <h2>Become a Seller — Multi-Vendor Application</h2>
                            <p>
                              Interested in selling your products on MEGAZONE? Read our seller terms, fill out the form below with your desired Admin Gmail &amp; Password, and submit for Super Admin approval.
                            </p>
                          </div>
                        </div>

                        {sellerApplication && !isSellerApproved && (
                          <div className="seller-pending-banner">
                            <h4>
                              ⏳ Application Sent to Super Admin ({sellerApplication.shopName})
                            </h4>
                            <p>
                              Your multi-vendor application for{" "}
                              <strong>{sellerApplication.shopName}</strong> (Admin Login Gmail:{" "}
                              <strong>{sellerApplication.email}</strong> · Phone:{" "}
                              {sellerApplication.phone}) is currently pending review in the{" "}
                              <strong>Super Admin Panel</strong>. Once Super Admin registers your Gmail &amp; Password as an Admin/Seller and approves your status, your{" "}
                              <strong>Approval Message and Admin Panel Link (URL)</strong> will appear right here in your Profile!
                            </p>
                          </div>
                        )}

                        {sellerSuccess ? (
                          <div className="order-success">
                            <div className="success-check">✓</div>
                            <h3>Application Received by Super Admin Panel!</h3>
                            <p>{sellerSuccess}</p>
                            <button
                              type="button"
                              className="checkout-submit"
                              onClick={() => setSellerSuccess("")}
                            >
                              Back to Seller Status
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleSellerSubmit}>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                              1. Choose Your Multi-Vendor Membership Plan
                            </h3>
                            <div className="seller-plan-grid">
                              <div
                                className={`seller-plan-card ${sellerForm.plan === "trial_30_days" ? "selected" : ""}`}
                                onClick={() =>
                                  setSellerForm({ ...sellerForm, plan: "trial_30_days" })
                                }
                              >
                                <small>NEW VENDOR ONBOARDING</small>
                                <h4>1-Month Free Trial (Rs. 0 Today)</h4>
                                <p>
                                  Test your shop free for 30 days. Satisfied after 1 month? Pay the one-time{" "}
                                  <strong>{money(lifetimeFeeSetting)}</strong> fee to keep listing your products for life!
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
                                  Pay once and list unlimited products forever on MEGAZONE with zero monthly subscription.
                                </p>
                              </div>
                            </div>

                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                              2. Store Details &amp; Admin Panel Login Credentials (Sent to Super Admin)
                            </h3>
                            <div className="checkout-field-grid">
                              <label>
                                Shop / Vendor Store Name *
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

                              {/* Always collect Gmail & Password so Super Admin can add them in New Admin */}
                              <label>
                                Seller Admin Login Gmail *
                                <input
                                  required
                                  type="email"
                                  value={sellerForm.email}
                                  onChange={(e) =>
                                    setSellerForm({ ...sellerForm, email: e.target.value })
                                  }
                                  placeholder="yourstore@gmail.com"
                                />
                              </label>
                              <label>
                                Seller Admin Login Password *
                                <input
                                  required
                                  type="password"
                                  minLength={6}
                                  value={sellerForm.password}
                                  onChange={(e) =>
                                    setSellerForm({
                                      ...sellerForm,
                                      password: e.target.value,
                                    })
                                  }
                                  placeholder="Password for Admin Panel access (min 6 chars)"
                                />
                              </label>

                              <label className="field-full">
                                Primary Product Category
                                <select
                                  value={sellerForm.categoryFocus}
                                  onChange={(e) =>
                                    setSellerForm({
                                      ...sellerForm,
                                      categoryFocus: e.target.value,
                                    })
                                  }
                                >
                                  <option value="Electronics, Fashion & General Merchandise">
                                    Electronics, Fashion &amp; General Merchandise
                                  </option>
                                  <option value="Electronics & Phones Accessories">
                                    Electronics &amp; Phones Accessories
                                  </option>
                                  <option value="Fashion, Shoes & Watches">
                                    Fashion, Shoes &amp; Watches
                                  </option>
                                  <option value="Home, Kitchen & Beauty">
                                    Home, Kitchen &amp; Beauty
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
                                    setSellerForm({
                                      ...sellerForm,
                                      accountTitle: e.target.value,
                                    })
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
                                    setSellerForm({
                                      ...sellerForm,
                                      bankAccount: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. Meezan Bank - PK00MEZN..."
                                />
                              </label>
                            </div>

                            {sellerForm.plan === "lifetime_direct" && (
                              <div className="online-payment-box" style={{ marginTop: 16 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <b>
                                    Pay One-Time Lifetime Seller Fee:{" "}
                                    <span style={{ color: "#01411c", fontSize: 16 }}>
                                      {money(lifetimeFeeSetting)}
                                    </span>
                                  </b>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: "#e6f4ec",
                                      color: "#01411c",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    Verified by Super Admin via TRX ID
                                  </span>
                                </div>

                                <p style={{ margin: "4px 0 8px", fontSize: 13 }}>
                                  Send the one-time Lifetime Seller Access fee of{" "}
                                  <strong>{money(lifetimeFeeSetting)}</strong> (set by Super Admin) to the official Super Admin account below, then enter your{" "}
                                  <strong>TRX / Transaction ID</strong> so Super Admin can verify it in the Super Dashboard and approve your seller account:
                                </p>

                                <div className="payment-account-card">
                                  <b>
                                    Super Admin Account Title:{" "}
                                    {superAdminPaymentAccount.accountTitle || "MEGAZONE Super Admin"}
                                  </b>

                                  {superAdminPaymentAccount.accountNumber && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span>
                                        Account Number:{" "}
                                        <strong className="tabular-nums">
                                          {superAdminPaymentAccount.accountNumber}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-cart"
                                        style={{ minHeight: 28, padding: "2px 10px", fontSize: 11.5 }}
                                        onClick={() => {
                                          navigator.clipboard?.writeText(
                                            superAdminPaymentAccount.accountNumber,
                                          );
                                          showToast("Super Admin Account Number copied!");
                                        }}
                                      >
                                        Copy Account #
                                      </button>
                                    </div>
                                  )}

                                  {superAdminPaymentAccount.easypaisa && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span>
                                        Easypaisa Account:{" "}
                                        <strong className="tabular-nums">
                                          {superAdminPaymentAccount.easypaisa}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-cart"
                                        style={{ minHeight: 28, padding: "2px 10px", fontSize: 11.5 }}
                                        onClick={() => {
                                          navigator.clipboard?.writeText(
                                            superAdminPaymentAccount.easypaisa,
                                          );
                                          showToast("Super Admin Easypaisa number copied!");
                                        }}
                                      >
                                        Copy Easypaisa
                                      </button>
                                    </div>
                                  )}

                                  {superAdminPaymentAccount.jazzcash && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span>
                                        JazzCash Account:{" "}
                                        <strong className="tabular-nums">
                                          {superAdminPaymentAccount.jazzcash}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-cart"
                                        style={{ minHeight: 28, padding: "2px 10px", fontSize: 11.5 }}
                                        onClick={() => {
                                          navigator.clipboard?.writeText(
                                            superAdminPaymentAccount.jazzcash,
                                          );
                                          showToast("Super Admin JazzCash number copied!");
                                        }}
                                      >
                                        Copy JazzCash
                                      </button>
                                    </div>
                                  )}

                                  {superAdminPaymentAccount.bankAccount && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span>
                                        {superAdminPaymentAccount.bankName
                                          ? `${superAdminPaymentAccount.bankName}: `
                                          : "Bank / IBAN: "}
                                        <strong className="tabular-nums">
                                          {superAdminPaymentAccount.bankAccount}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-cart"
                                        style={{ minHeight: 28, padding: "2px 10px", fontSize: 11.5 }}
                                        onClick={() => {
                                          navigator.clipboard?.writeText(
                                            superAdminPaymentAccount.bankAccount,
                                          );
                                          showToast("Super Admin Bank Account copied!");
                                        }}
                                      >
                                        Copy Bank #
                                      </button>
                                    </div>
                                  )}

                                  {!superAdminPaymentAccount.accountNumber &&
                                    !superAdminPaymentAccount.easypaisa &&
                                    !superAdminPaymentAccount.jazzcash &&
                                    !superAdminPaymentAccount.bankAccount && (
                                      <span style={{ fontSize: 12.5, color: "#01411c" }}>
                                        Official Super Admin Account Number will automatically display here as soon as Super Admin sets it in the Super Admin Panel (Settings → Marketplace Payment).
                                      </span>
                                    )}

                                  {superAdminPaymentAccount.instructions && (
                                    <small style={{ display: "block", marginTop: 4, color: "#3b5244" }}>
                                      {superAdminPaymentAccount.instructions}
                                    </small>
                                  )}
                                </div>

                                <label style={{ marginTop: 6 }}>
                                  Enter Your Payment TRX ID / Reference Number (Sent to Super Admin) *
                                  <input
                                    required
                                    value={sellerForm.paymentReference}
                                    onChange={(e) =>
                                      setSellerForm({
                                        ...sellerForm,
                                        paymentReference: e.target.value,
                                      })
                                    }
                                    placeholder="e.g. TRX ID 84920193842 (Easypaisa / JazzCash / Bank)"
                                  />
                                </label>
                              </div>
                            )}

                            {/* Seller Terms & Conditions Box */}
                            <div className="policy-terms-box">
                              <h4>4. MEGAZONE Multi-Vendor Seller Terms &amp; Conditions</h4>
                              <ul>
                                <li>
                                  <strong>Admin Panel Verification:</strong> Your submitted Gmail and Password will be reviewed by the Super Admin. Once approved, Super Admin will activate your Vendor Admin account and share the Admin Panel URL in your Profile.
                                </li>
                                <li>
                                  <strong>1-Month Free Trial &amp; Lifetime Plan:</strong> New sellers receive 30 days of free selling. After 1 month, a one-time lifetime fee ({money(lifetimeFeeSetting)}) applies to continue listing products forever.
                                </li>
                                <li>
                                  <strong>Product Quality &amp; Dispatch:</strong> Sellers must upload accurate photos and descriptions and dispatch confirmed orders promptly across Pakistan.
                                </li>
                              </ul>
                              <label className="terms-checkbox-row">
                                <input
                                  type="checkbox"
                                  required
                                  checked={sellerForm.acceptedTerms}
                                  onChange={(e) =>
                                    setSellerForm({
                                      ...sellerForm,
                                      acceptedTerms: e.target.checked,
                                    })
                                  }
                                />
                                <span>
                                  I have read and agree to the MEGAZONE Multi-Vendor Seller Terms &amp; Conditions, and authorize Super Admin to create my Seller Admin access using the Gmail and Password above.
                                </span>
                              </label>
                            </div>

                            {sellerError && <div className="checkout-error">{sellerError}</div>}

                            <button
                              type="submit"
                              className="checkout-submit"
                              disabled={sellerSubmitting}
                            >
                              {sellerSubmitting
                                ? "Sending Application to Super Admin…"
                                : sellerApplication
                                  ? "Update My Seller Application"
                                  : "Submit Seller Application for Approval"}
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
          </>
        )}
      </main>

      {/* Green Footer ONLY on the Home Page when scrolled to the bottom (Contains Terms, Policies & Customer Care — NO Categories/Seller spam) */}
      {activeTab === "home" && !selectedProduct && (
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <a
                href="#top"
                className="footer-brand-white"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span className="brand-flag-mark" aria-hidden="true">
                  ☪
                </span>
                MEGAZONE
              </a>
              <p className="footer-meta">
                MEGAZONE Pakistan is an online shopping platform dedicated to authentic products, nationwide Cash on Delivery (COD), transparent pricing, and 7-day customer return protection.
              </p>
            </div>

            <div className="footer-col">
              <h4>Terms &amp; Legal Policies</h4>
              <ul>
                <li>
                  <button type="button" onClick={() => setActivePolicyKey("terms")}>
                    Terms &amp; Conditions of Use
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActivePolicyKey("returns")}>
                    7-Day Return &amp; Refund Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActivePolicyKey("shipping")}>
                    Shipping &amp; COD Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActivePolicyKey("privacy")}>
                    Privacy &amp; Buyer Protection
                  </button>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Shopping Rules &amp; COD</h4>
              <ul>
                <li>
                  <span>✓ Nationwide Doorstep Cash on Delivery</span>
                </li>
                <li>
                  <span>✓ Parcel Verification &amp; Live Order ID</span>
                </li>
                <li>
                  <span>✓ Secure Easypaisa, JazzCash &amp; Bank</span>
                </li>
                <li>
                  <span>✓ 7-Day Easy Check &amp; Replacement</span>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Customer Account &amp; Help</h4>
              <ul>
                <li>
                  <button type="button" onClick={() => switchMainTab("orders")}>
                    Track Your Order Status
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSection("account");
                      switchMainTab("profile");
                    }}
                  >
                    Account &amp; Delivery Settings
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSection("seller");
                      switchMainTab("profile");
                    }}
                  >
                    Multi-Vendor Seller Terms &amp; Apply
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 MEGAZONE Pakistan · Online Shopping Platform. All Rights Reserved.</span>
            <span>Terms &amp; Conditions · Privacy Policy · 7-Day Easy Return · Cash on Delivery</span>
          </div>
        </footer>
      )}

      {/* Mobile Fixed Bottom 5-Tab Bar (Home, Categories, Cart, My Orders, Profile) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "home" && !selectedProduct ? "active" : ""}`}
          onClick={() => switchMainTab("home")}
        >
          <Home size={18} />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "categories" && !selectedProduct ? "active" : ""}`}
          onClick={() => switchMainTab("categories")}
        >
          <LayoutGrid size={18} />
          <span>Categories</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "cart" && !selectedProduct ? "active" : ""}`}
          onClick={() => switchMainTab("cart")}
        >
          <ShoppingBag size={18} />
          <span>Cart ({totalCartCount})</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "orders" && !selectedProduct ? "active" : ""}`}
          onClick={() => switchMainTab("orders")}
        >
          <ClipboardList size={18} />
          <span>Orders{allMyOrders.length > 0 ? ` (${allMyOrders.length})` : ""}</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeTab === "profile" && !selectedProduct ? "active" : ""}`}
          onClick={() => switchMainTab("profile")}
        >
          <UserRound size={18} />
          <span>Profile</span>
        </button>
      </nav>

      {/* Terms & Policies Reader Modal */}
      {activePolicy && (
        <div className="modal-backdrop" onClick={() => setActivePolicyKey(null)}>
          <section
            className="modal-sheet"
            style={{ width: "min(640px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="checkout-header">
              <div>
                <h2>{activePolicy.title}</h2>
                <p>MEGAZONE Pakistan Official Shopping Policy</p>
              </div>
              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setActivePolicyKey(null)}
                aria-label="Close policy"
              >
                <X size={18} />
              </button>
            </header>
            <div className="checkout-form">
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75, fontSize: 14 }}>
                {activePolicy.points.map((pt, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    {pt}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="checkout-submit"
                onClick={() => setActivePolicyKey(null)}
              >
                I Understand
              </button>
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
                    : "Fill in your delivery details to place your order."}
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
                      switchMainTab("orders");
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
                    <h3>Customer &amp; Delivery Information</h3>

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
                      <label>
                        Email Address (optional)
                        <input
                          type="email"
                          value={checkoutForm.email}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, email: e.target.value })
                          }
                          placeholder="For order receipt"
                        />
                      </label>
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
                      className={`payment-option ${checkoutForm.payment === "cod" ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="payment"
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
                        <small>Pay cash at your doorstep when your parcel arrives</small>
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
