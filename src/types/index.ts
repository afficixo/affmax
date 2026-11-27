export type UserRole = 'MANAGER' | 'PUBLISHER'

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
  lastLogin: string | null
}

export interface LinkAccount {
  id: string
  accountName: string
  slug: string
  customDomainId: string | null
  offerGroupName: string | null
  userId: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  totalClicks: number
  uniqueClicks: number
  botClicks: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
  limit: number
}