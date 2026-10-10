/** Server-only. The Google button stays hidden until this is exactly "true". */
export function googleSignInEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN === "true";
}
