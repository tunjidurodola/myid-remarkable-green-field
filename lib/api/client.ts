/**
 * API Client - Base fetch wrapper with authentication and error handling
 */

import { EncryptedStorage } from '../storage/encrypted-storage';

// API configuration
const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request options
 */
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retry?: boolean;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  ok: boolean;
}

/**
 * API Error class
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  response?: Response;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.response = response;
  }

  /**
   * Check if error is network-related
   */
  isNetworkError(): boolean {
    return this.status === 0;
  }

  /**
   * Check if error is authentication-related
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Check if error is validation-related
   */
  isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /**
   * Check if error is server-related
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.isNetworkError() || this.isServerError();
  }
}

/**
 * Build URL with query parameters
 */
function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_CONFIG.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Sleep utility for retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an abort controller with timeout
 */
function createAbortControllerWithTimeout(
  timeout: number,
  existingSignal?: AbortSignal
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If an existing signal is provided, abort when it aborts
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * Core API client class
 */
export class ApiClient {
  private static instance: ApiClient;
  private refreshPromise: Promise<boolean> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Get authentication headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = EncryptedStorage.getAccessToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /**
   * Handle token refresh
   */
  private async refreshToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const session = await EncryptedStorage.getCurrentSession();
        if (!session?.refreshToken) {
          return false;
        }

        const response = await fetch(`${API_CONFIG.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        await EncryptedStorage.updateSessionTokens(
          data.accessToken,
          data.refreshToken
        );

        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Make an API request
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers: customHeaders = {},
      body,
      params,
      timeout = API_CONFIG.timeout,
      retry = true,
      skipAuth = false,
      signal,
    } = options;

    const url = buildUrl(endpoint, params);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    // Add auth headers if not skipped
    if (!skipAuth) {
      const authHeaders = await this.getAuthHeaders();
      Object.assign(headers, authHeaders);
    }

    // Setup abort controller with timeout
    const { controller, cleanup } = createAbortControllerWithTimeout(timeout, signal);

    // Make request with retry logic
    let lastError: ApiError | null = null;
    const maxAttempts = retry ? API_CONFIG.retryAttempts : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        cleanup();

        // Handle 401 - try to refresh token
        if (response.status === 401 && !skipAuth && attempt === 1) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry with new token
            const newAuthHeaders = await this.getAuthHeaders();
            Object.assign(headers, newAuthHeaders);
            continue;
          }
        }

        // Parse response
        let data: T;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as unknown as T;
        }

        // Check for error responses
        if (!response.ok) {
          const errorData = data as { message?: string; code?: string; details?: unknown };
          throw new ApiError(
            errorData.message || `Request failed with status ${response.status}`,
            response.status,
            errorData.code,
            errorData.details,
            response
          );
        }

        return {
          data,
          status: response.status,
          headers: response.headers,
          ok: true,
        };
      } catch (error) {
        cleanup();

        if (error instanceof ApiError) {
          lastError = error;

          // Don't retry auth errors or validation errors
          if (error.isAuthError() || error.isValidationError()) {
            throw error;
          }

          // Retry if retryable and not last attempt
          if (error.isRetryable() && attempt < maxAttempts) {
            await sleep(API_CONFIG.retryDelay * attempt);
            continue;
          }

          throw error;
        }

        // Handle network errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new ApiError('Request timeout', 0, 'TIMEOUT');
          }

          lastError = new ApiError(
            error.message || 'Network error',
            0,
            'NETWORK_ERROR'
          );

          if (attempt < maxAttempts) {
            await sleep(API_CONFIG.retryDelay * attempt);
            continue;
          }

          throw lastError;
        }

        throw new ApiError('Unknown error', 0, 'UNKNOWN_ERROR');
      }
    }

    throw lastError || new ApiError('Request failed after retries', 0, 'RETRY_EXHAUSTED');
  }

  /**
   * GET request
   */
  get<T = unknown>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  delete<T = unknown>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Export convenience methods
export const api = {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  request: apiClient.request.bind(apiClient),
};

export default api;
