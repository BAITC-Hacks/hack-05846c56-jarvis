export type Locale = 'ru' | 'kk';
export interface Product { id: string; sku: string; name: string; category: string; brand: string; price: number | null; currency: string; stock: number; unit: string; image: string | null; url: string; description: string; specs: Record<string,string>; certificates: {name:string;url:string}[]; warehouses: {name:string;stock:number}[]; source: 'live' | 'snapshot' | 'demo'; fetchedAt: string; }
export interface CartLine { product: Product; quantity: number; }
export interface Cart { id: string; items: CartLine[]; total: number; updatedAt: string; mode: 'prototype'; }
export interface Attachment { name: string; type: string; text?: string; dataUrl?: string; }
export interface ChatMessage { role: 'user' | 'assistant'; content: string; productIds?: string[]; }
export interface SpecificationRow { label: string; quantity: number | null; products: Product[]; exact: boolean; }
export interface ChatResponse { message: string; products: Product[]; suggestions: string[]; specification?: SpecificationRow[]; proposedItems?: {productId:string;quantity:number}[]; sources: {title:string;url:string}[]; mode: 'ai' | 'catalog'; }
