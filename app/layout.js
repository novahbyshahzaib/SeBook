import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata = {
  title: "SeBook — Write Your Book",
  description: "Write books of every type, with all the tools a writer needs.",
  manifest: "/manifest.webmanifest",
  themeColor: "#1b1712",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SeBook" }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
