type PasswordRecoveryState = {
  email: string | null;
  requestId: string | null;
  resetToken: string | null;
  succeeded: boolean;
};

// Deliberately process-memory only. Reset credentials must never be persisted
// on the device or exposed through navigation parameters.
let state: PasswordRecoveryState = {
  email: null,
  requestId: null,
  resetToken: null,
  succeeded: false,
};

export function beginPasswordRecovery(email: string, requestId: string): void {
  state = { email, requestId, resetToken: null, succeeded: false };
}

export function getPasswordRecoveryRequest(): Pick<PasswordRecoveryState, 'email' | 'requestId'> {
  return { email: state.email, requestId: state.requestId };
}

export function storePasswordResetToken(resetToken: string): void {
  state = { ...state, resetToken };
}

export function getPasswordResetToken(): string | null {
  return state.resetToken;
}

export function completePasswordRecovery(): void {
  state = { email: null, requestId: null, resetToken: null, succeeded: true };
}

export function hasPasswordRecoverySuccess(): boolean {
  return state.succeeded;
}

export function consumePasswordRecoverySuccess(): boolean {
  const succeeded = state.succeeded;
  state = { ...state, succeeded: false };
  return succeeded;
}

export function clearPasswordRecovery(): void {
  state = { email: null, requestId: null, resetToken: null, succeeded: false };
}
