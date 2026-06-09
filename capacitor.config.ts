import type { CapacitorConfig } from "@capacitor/cli";

// Native iOS/Android shell for Tidings. Loads the live tidings.gatheredin.app site
// via server.url, with native plugins (splash) for real native value to pass Apple
// review guideline 4.2. Mirror of the Homefront/Steward/Knit pattern.
const config: CapacitorConfig = {
  appId: "app.gatheredin.tidings",
  appName: "Tidings",
  webDir: "public",
  server: {
    url: "https://tidings.gatheredin.app",
    cleartext: false,
  },
  ios: {
    backgroundColor: "#FFFFFF",
  },
};

export default config;
