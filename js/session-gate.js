export class AuthenticationRequiredError extends Error {
  constructor() { super("Entre na sua conta para continuar."); this.name = "AuthenticationRequiredError"; }
}

// A cached session alone does not prove that its user/token is still valid.
export async function requireAuthenticatedUser(client) {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData?.session) throw new AuthenticationRequiredError();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user || data.user.id !== sessionData.session.user.id) throw new AuthenticationRequiredError();
  return data.user;
}
