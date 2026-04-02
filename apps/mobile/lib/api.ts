import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

class ApiClient {
  private async getHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    const headers = await this.getHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new Error('Session expired. Please sign in again.');
      }

      if (response.status === 429) {
        throw new Error('Too many requests. Please try again in a moment.');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error.error || `Request failed (${response.status})`;
        // Retry on server errors
        if (response.status >= 500 && retries > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          return this.request<T>(path, options, retries - 1);
        }
        throw new Error(message);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : (undefined as T);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (retries > 0) {
          return this.request<T>(path, options, retries - 1);
        }
        throw new Error('Request timed out. Check your connection and try again.');
      }
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          return this.request<T>(path, options, retries - 1);
        }
        throw new Error('Unable to connect. Check your internet and try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(path: string): Promise<void> {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
