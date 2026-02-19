import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'income' | 'expense';
  amount: number;
  units: number;
  unit_price: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

export interface UserSettings {
  targetSales: number;
  chartType: 'bar' | 'area' | 'pie';
  items: {
    name: string;
    price: number;
    type: 'income' | 'expense';
    hidden?: boolean;
  }[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  settings: UserSettings;
}
