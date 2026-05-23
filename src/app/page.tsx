"use client";

import { useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { VariantBSplit } from "@/components/VariantBSplit";

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);

  if (!signedIn) {
    return <AuthScreen onSignIn={() => setSignedIn(true)} />;
  }
  return <VariantBSplit onSignOut={() => setSignedIn(false)} />;
}
