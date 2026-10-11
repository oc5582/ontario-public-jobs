/** JSON body posted to the signup Worker. Same fields as the live site's app.js. */
export function weeklyAlertPayload(email: string): {
  email: string;
  casl_consent: "yes";
  _gotcha: "";
} {
  return {
    email: email.trim().toLowerCase(),
    casl_consent: "yes",
    _gotcha: "",
  };
}
