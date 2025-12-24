import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "./hooks/useAuth";
import { UserProfileProvider } from "./providers/UserProfileProvider";
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ekarihub",
  description: "Where Agribusiness Meets Community",
  icons: {
    icon: "/ekarihub-favicon-logo-green.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <AuthProvider>

          <UserProfileProvider>
            {children}
          </UserProfileProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
