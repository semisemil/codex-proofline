import { greeting } from './login.js';

export function renderHeader(session) {
  return `<header>${greeting(session)}</header>`;
}
