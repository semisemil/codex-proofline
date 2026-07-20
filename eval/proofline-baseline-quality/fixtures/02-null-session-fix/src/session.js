export function getLoginState(session) {
  const userId = session.user.id;
  return {
    authenticated: Boolean(userId),
    userId,
  };
}
