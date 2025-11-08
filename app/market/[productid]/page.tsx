"use client";

import { useParams } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import ProductDetailsClient from "./ProductDetailsClient";

export default function Page() {
  const params = useParams<{ productid: string }>();
  return <AppShell><ProductDetailsClient params={params} /></AppShell>;
}
