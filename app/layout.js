import "./globals.css";

export const metadata = {
  title: "SeBook — Write Your Book",
  description: "Write books of every type, with all the tools a writer needs."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
