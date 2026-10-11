/** Server-only. Google sign-in stays on unless this is exactly "false". */
export function googleSignInEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN !== "false";
}
