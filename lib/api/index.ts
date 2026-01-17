/**
 * API module exports
 */

// Client
export {
  ApiClient,
  apiClient,
  api,
  ApiError,
  type ApiResponse,
  type RequestOptions,
  type HttpMethod,
} from './client';

// Auth
export {
  authApi,
  type AuthUser,
  type AuthTokens,
  type LoginResponse,
  type RegisterResponse,
  type PasskeyLoginResponse,
  type RegisterData,
  type LoginData,
  type ResetPasswordData,
} from './auth';

// User
export {
  userApi,
  type UserProfile,
  type ProfileUpdateData,
  type StoredMasterCode,
  type TrustCode,
  type CreateTrustCodeRequest,
} from './user';

// Re-export for convenience
import { apiClient as client } from './client';
import { authApi as auth } from './auth';
import { userApi as user } from './user';

// Default export
const apiExports = {
  client,
  auth,
  user,
};

export default apiExports;
