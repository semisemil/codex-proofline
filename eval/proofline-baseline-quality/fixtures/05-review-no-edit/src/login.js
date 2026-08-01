export function currentUser(session) {
  return session.user.name;
}

export function greeting(session) {
  return `안녕하세요, ${currentUser(session)}님`;
}
