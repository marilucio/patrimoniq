export interface AuthenticatedRequestContext {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
}

export interface RequestWithAuth {
  headers: {
    cookie?: string;
  };
  auth?: AuthenticatedRequestContext;
}
