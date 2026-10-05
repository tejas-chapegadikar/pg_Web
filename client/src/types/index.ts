// User Types
export interface User {
  _id: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
  role: 'student' | 'owner';
  phone?: string;
  phoneVerified?: boolean;
  firebaseUid?: string;
  isOnboarded?: boolean;
  avatar?: string;
  createdAt: string;
}

// Auth Types
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'owner';
  /** The 6-digit code emailed to `email` (see authApi.sendSignupCode) */
  code: string;
}

export interface AuthResponse {
  status: string;
  data: {
    user: User;
    accessToken: string;
  };
}

export interface UpdateProfilePayload {
  name?: string;
  role?: 'student' | 'owner';
  phone?: string;
}

// PG Listing Types
export interface PGLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PGImage {
  url: string;
  publicId: string;
}

export type PropertyType = 'pg' | 'flat';

export interface PGListing {
  _id: string;
  /** Missing on listings created before flats existed — treat as 'pg' */
  propertyType?: PropertyType;
  title: string;
  description: string;
  location: PGLocation;
  rent: number;
  deposit: number;
  genderPreference: 'male' | 'female' | 'any';
  /** PGs only */
  roomType?: 'single' | 'double' | 'triple' | 'dormitory';
  /** Flats only */
  bhk?: number;
  totalRooms: number;
  availableRooms: number;
  amenities: string[];
  images: PGImage[];
  rentIncludes?: string[];
  additionalCharges?: string;
  ratingAverage?: number;
  numReviews?: number;
  owner: User | string;
  active: boolean;
  analytics: {
    views: number;
    inquiries: number;
    saves: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Review Types
export interface Review {
  _id: string;
  pg: string;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  status: string;
  data: {
    reviews: Review[];
    total: number;
    page: number;
    totalPages: number;
    ratingDistribution: Record<number, number>;
  };
}

export interface CreateReviewPayload {
  rating: number;
  comment: string;
}

// Chatbot Types
export interface ChatbotMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  recommendations?: PGListing[];
  timestamp: Date;
}

export interface ChatbotResponse {
  status: string;
  data: {
    reply: string;
    recommendations: PGListing[];
  };
}

export interface PGListingsResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
  // getAllPGs spreads result at top level (no data wrapper)
  listings: PGListing[];
  // getMyListings wraps in data
  data?: {
    listings: PGListing[];
  };
}

export interface PGFilters {
  city?: string;
  /** Free-text search over name, address and city */
  q?: string;
  propertyType?: PropertyType;
  /** '2' = exactly 2 BHK, '3+' = 3 or more */
  bhk?: string;
  minRent?: number;
  maxRent?: number;
  genderPreference?: string;
  roomType?: string;
  amenities?: string;
  page?: number;
  limit?: number;
  sort?: string;
  availableOnly?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;   // km
  college?: string;  // display label
}

export interface CreatePGPayload {
  propertyType?: PropertyType;
  title: string;
  description: string;
  location: PGLocation;
  rent: number;
  deposit: number;
  genderPreference: 'male' | 'female' | 'any';
  roomType?: 'single' | 'double' | 'triple' | 'dormitory';
  bhk?: number;
  totalRooms: number;
  availableRooms: number;
  amenities: string[];
  rentIncludes?: string[];
  additionalCharges?: string;
}

// Inquiry Types
export interface Inquiry {
  _id: string;
  pg: PGListing | string;
  student: User | string;
  message: string;
  phone: string;
  /** Preferred day to visit (ISO, UTC midnight) */
  visitDate?: string;
  status: 'pending' | 'viewed' | 'responded' | 'closed';
  createdAt: string;
}

export interface CreateInquiryPayload {
  pgId: string;
  message: string;
  phone: string;
  /** YYYY-MM-DD */
  visitDate?: string;
}

// Dashboard Types
export interface DashboardStats {
  totalListings: number;
  availableListings: number;
  totalViews: number;
  totalInquiries: number;
  totalSaves: number;
  recentListings: PGListing[];
  recentInquiries: Inquiry[];
}

// API Response Types
export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
  data: T;
}
