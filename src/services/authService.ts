import { supabase } from './supabaseClient'
import * as bcrypt from 'bcryptjs'

interface LoginResponse {
  success: boolean
  error?: string
  user?: {
    id: string
    email: string
  }
}

interface AuthUser {
  id: string
  email: string
}

class AuthService {
  private currentUser: AuthUser | null = null

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, password_hash')
        .eq('email', email)
        .maybeSingle()

      if (error || !data) {
        return { success: false, error: 'Invalid email or password' }
      }

      const passwordMatch = await bcrypt.compare(password, data.password_hash)

      if (!passwordMatch) {
        return { success: false, error: 'Invalid email or password' }
      }

      this.currentUser = {
        id: data.id,
        email: data.email
      }

      localStorage.setItem('auth_user', JSON.stringify(this.currentUser))

      return {
        success: true,
        user: this.currentUser
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  }

  async logout(): Promise<void> {
    this.currentUser = null
    localStorage.removeItem('auth_user')
  }

  getCurrentUser(): AuthUser | null {
    if (this.currentUser) {
      return this.currentUser
    }

    const stored = localStorage.getItem('auth_user')
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored)
        return this.currentUser
      } catch {
        return null
      }
    }

    return null
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }
}

export const authService = new AuthService()
