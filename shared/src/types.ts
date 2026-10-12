export type ProductType = "physical" | "digital";
export type ProductStatus = "draft" | "pending" | "published" | "rejected" | "disabled";
export type SellerStatus = "pending" | "active" | "suspended" | "rejected";

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  type: ProductType;
  price: number;
  compareAtPrice?: number;
  sellerName: string;
  sellerId: string;
  status: ProductStatus;
  images: string[];
  rating?: number;
  reviewCount?: number;
  brand?: string;
  sku?: string;
  stock?: number;
  warranty?: string;
  deliveryTime?: string;
  returnPolicy?: string;
  highlights?: string[];
  specifications?: Record<string, string> | Array<{ label: string; value: string }>;
  digitalFormat?: string;
  licenseTerms?: string;
  gameTopUp?: boolean;
  gameName?: string;
  gamePackage?: string;
}

export interface SellerMembership {
  sellerId: string;
  status: SellerStatus;
  membershipType: "lifetime";
  amountPaid: number;
  currency: "PKR";
  paymentStatus: "unpaid" | "pending_verification" | "verified";
  paymentReference?: string;
  paidAt?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}
