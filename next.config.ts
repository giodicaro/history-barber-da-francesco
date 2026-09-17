import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nella home dell'utente c'è un altro package-lock.json: senza una radice
  // esplicita Next la cerca risalendo le cartelle e avvisa a ogni avvio.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
